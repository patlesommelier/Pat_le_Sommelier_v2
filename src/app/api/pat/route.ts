import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { texteClassements } from '@/lib/classement-chat';
import { chargerContexte } from '@/lib/contexte';
import { getRestaurant } from '@/lib/donnees';
import { instructionsPat } from '@/lib/instructions-pat';
import { appOuverte } from '@/lib/ouverture';
import { requete } from '@/lib/db';
import { extraireVins, texteCarte, texteRegles } from '@/lib/pat-cerveau';

export const runtime = 'nodejs';

interface Corps {
  restaurant: string;
  plat?: string | null;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

const CATEGORIES: Record<string, string> = { entree: 'Entrées', plat: 'Plats', dessert: 'Desserts', fromage: 'Fromages' };
/** Nom du plat sans les mentions de portion (« prix à la pièce », « 2 pcs »). */
const nomAllege = (nom: string) => nom.replace(/\s*\((?:[^)]*pi[eè]ce[^)]*|\d+\s*pcs?)\)/gi, '').replace(/\s*[-–·,]?\s*\d+\s*pcs?\b/gi, '').trim();

export async function POST(req: Request) {
  const corps = (await req.json()) as Corps;
  if (!corps?.restaurant || !Array.isArray(corps.messages) || !corps.messages.length) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 });
  }
  // Restaurant pas encore en service (ou suspendu) : Pat ne répond pas aux clients.
  if (!(await appOuverte(corps.restaurant))) return NextResponse.json({ erreur: 'La carte des vins de Pat arrive très bientôt.' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ erreur: "Pat n'est pas encore branché : ANTHROPIC_API_KEY manquante." }, { status: 503 });
  }

  const [ctx, restaurant] = await Promise.all([chargerContexte(corps.restaurant), getRestaurant(corps.restaurant)]);
  if (!restaurant || !ctx.carte.length) return NextResponse.json({ erreur: 'Restaurant inconnu' }, { status: 404 });
  const plat = corps.plat ? ctx.plats.find((p) => p.id === corps.plat) : undefined;

  // Pat ne cherche que dans la table d'accords : seuls les vins qui ont un accord validé (au-dessus du seuil)
  // sur au moins un plat lui sont donnés, et chaque vin qu'il cite est vérifié ci-dessous.
  const accords = await requete<{ plat_id: string; vin_id: string; texte: string | null }>(
    `select plat_id, vin_id, coalesce(explication_longue, explication) as texte
       from accord where restaurant_id = $1 and statut = 'valide' and note >= 3`, [corps.restaurant]);
  const accord = new Map(accords.map((a) => [`${a.plat_id}|${a.vin_id}`, a]));
  const avecAccord = new Set(accords.map((a) => a.vin_id));
  const carte = ctx.carte.filter((v) => avecAccord.has(v.id));

  const categories = [...new Set(ctx.plats.map((p) => p.categorie))];
  const menu = categories
    .map((c) => `${CATEGORIES[c] ?? c}\n${ctx.plats.filter((p) => p.categorie === c).map((p) => `- ${nomAllege(p.nom)} [${p.id}]`).join('\n')}`)
    .join('\n');
  // Classement calculé par le serveur avec les règles du sommelier du restaurant : Pat le suit, il ne le recalcule pas.
  const classements = await texteClassements(corps.restaurant, ctx.plats);
  const consignes = ctx.regles.filter((r) => r.bloc === 2);

  // Données du restaurant : stables d'une question à l'autre, donc mises en cache avec les instructions.
  const donnees = [
    `MENU DE ${restaurant.nom.toUpperCase()}\n${menu}`,
    `CLASSEMENT DES VINS PAR PLAT (code du vin, note /5 de la table d'accords ; cuisine interne, jamais citée au client)\n${classements}`,
    `CARTE DES VINS DISPONIBLES (code | couleur | vin — producteur | millésime | format | prix | cépages | profil | ranking | avis de Pat | descriptif)\n${texteCarte(carte, { descriptif: true })}`,
    `CONSIGNES DU SOMMELIER DE ${restaurant.nom.toUpperCase()}\n${consignes.length ? texteRegles(consignes) : 'Aucune.'}`,
  ].join('\n\n');

  // Questions courtes : on garde les 12 derniers messages de la conversation.
  const historique: Anthropic.MessageParam[] = corps.messages
    .slice(-12)
    .map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: String(m.content).slice(0, 2000) }));
  while (historique.length && historique[0].role !== 'user') historique.shift();
  if (!historique.length) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 });
  if (plat) {
    const dernier = historique[historique.length - 1];
    historique[historique.length - 1] = { ...dernier, content: `[Le client consulte la page du plat « ${nomAllege(plat.nom)} » (${plat.id}).]\n\n${dernier.content}` };
  }

  const client = new Anthropic();
  const r = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
    max_tokens: 1200,
    system: [
      { type: 'text', text: instructionsPat({ nomRestaurant: restaurant.nom, categoriesMenu: categories.map((c) => CATEGORIES[c] ?? c).join(', ') }) },
      { type: 'text', text: donnees, cache_control: { type: 'ephemeral' } },
    ],
    messages: historique,
  });
  const texte = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  if (!texte.trim()) return NextResponse.json({ erreur: 'Pat ne répond pas pour le moment.' }, { status: 502 });
  const { reponse, vins: cites } = extraireVins(texte, carte.map((v) => v.id), ctx.plats.map((p) => p.id));
  // Chaque vin cité doit venir de la table d'accords : celui du plat indiqué par Pat (ou de la page consultée) ;
  // à défaut, le vin a au moins un accord et on montre sa présentation.
  const retenus = cites.flatMap(({ id, plat: p }) => {
    const pour = [p, corps.plat].find((x) => x && accord.has(`${x}|${id}`)) ?? null;
    return pour || avecAccord.has(id) ? [{ id, plat: pour }] : [];
  });
  const fiches = retenus.length ? await requete<{ id: string; libelle: string; producteur: string | null; millesime: string | null;
    prix: number | null; prix_verre: number | null; etiquette_url: string | null; presentation: string | null }>(
    `select v.id, v.libelle, case when v.modifie_bo is not null and v.producteur_texte is not null then v.producteur_texte else coalesce(p.nom, v.producteur_texte) end as producteur,
            nullif(v.millesime, 'NM') as millesime, v.prix::float as prix, v.prix_verre::float as prix_verre, v.etiquette_url,
            coalesce(v.presentation_carte_perso, v.presentation, v.presentation_carte, v.descriptif) as presentation
       from vin_carte v left join producteur p on p.id = v.producteur_id
      where v.restaurant_id = $1 and v.id = any($2)`, [corps.restaurant, retenus.map((r) => r.id)]) : [];
  return NextResponse.json({
    reponse,
    // Vin proposé : étiquette, puis le texte complet de l'accord avec ce plat (ou sa présentation). Jamais de note ni de ranking.
    vins: retenus.flatMap(({ id, plat: p }) => {
      const v = fiches.find((f) => f.id === id);
      if (!v) return [];
      return [{ id, plat: p, libelle: v.libelle, producteur: v.producteur, millesime: v.millesime, prix: v.prix, prix_verre: v.prix_verre,
        etiquette_url: v.etiquette_url, texte: (p ? accord.get(`${p}|${id}`)?.texte : null) ?? v.presentation }];
    }),
  });
}
