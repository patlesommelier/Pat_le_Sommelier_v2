import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { texteClassements } from '@/lib/classement-chat';
import { chargerContexte } from '@/lib/contexte';
import { getRestaurant } from '@/lib/donnees';
import { instructionsPat } from '@/lib/instructions-pat';
import { appOuverte } from '@/lib/ouverture';
import { extraireVins, textePrincipes, texteCarte, texteRegles } from '@/lib/pat-cerveau';

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
    `CARTE DES VINS DISPONIBLES (code | couleur | vin — producteur | millésime | format | prix | cépages | profil | ranking | avis de Pat | descriptif)\n${texteCarte(ctx.carte, { descriptif: true })}`,
    `PRINCIPES D'ACCORD DE PAT (pour un plat absent du menu ; confidentiels)\n${textePrincipes(ctx.principes)}`,
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
  const { reponse, vins } = extraireVins(texte, ctx.carte.map((v) => v.id));
  return NextResponse.json({
    reponse,
    vins: vins.map((id) => {
      const v = ctx.carte.find((x) => x.id === id)!;
      return { id, libelle: v.libelle, prix: v.prix };
    }),
  });
}
