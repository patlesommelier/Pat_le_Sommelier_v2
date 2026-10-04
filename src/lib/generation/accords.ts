/**
 * Régénération des accords d'un plat par Pat : note /5, commentaire client et limite interne pour chaque vin
 * disponible de la carte, en une passe (un appel à Claude par plat), puis contrôle et corrections.
 *
 * Utilisé par la fonction Netlify d'arrière-plan (bouton « Régénérer » du back-office) et par `npm run regenerer`.
 * Pas d'import « server-only » ici : ce module tourne aussi hors de Next (fonction Netlify, scripts).
 *
 * Règles d'écriture :
 * - accords écrits « validés » (montrés aux clients tout de suite) ;
 * - une note changée à la main dans le back-office (origine « sommelier ») est imposée à Pat et jamais remplacée ;
 * - un accord refusé reste refusé ;
 * - un vin dont la réponse reste fautive après les corrections garde son accord actuel.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { textePlat, textePrincipes, texteCarte, texteRegles, type PlatCtx, type PrincipeCtx, type RegleCtx, type VinCtx } from '../pat-cerveau';
import { controlerPlat, MOTS_INTERDITS, MOTS_MAX, MOTS_MIN, type VinAControler } from './controle';

export type Requete = <T>(sql: string, params?: unknown[]) => Promise<T[]>;

const CORRECTIONS = 2;

interface VinGen extends VinCtx { appellation: string | null; ordre: number }
interface AccordActuel { plat_id: string; vin_id: string; note: number | null; origine: string; statut: string }
interface Reponse { vin: string; note: number; commentaire: string; limite: string | null }

export interface Bilan { ecrits: number; imposes: number; aRevoir: string[]; jetonsEntree: number; jetonsSortie: number }

function consigneSysteme(principes: PrincipeCtx[], regles: RegleCtx[], carte: VinGen[]) {
  return `Tu es Pat, sommelier. Pour un plat d'un restaurant, tu notes chaque vin de sa carte et tu écris le commentaire d'accord que lira le client.

PRINCIPES DE PAT (ta seule doctrine pour noter)
${textePrincipes(principes)}

CONSIGNES DU SOMMELIER DU RESTAURANT
${regles.length ? texteRegles(regles) : 'Aucune.'}

NOTE (de 1 à 5, entière)
5 : accord remarquable ; 4 : très bel accord ; 3 : bon accord ; 2 : accord faible ; 1 : à éviter.
Jamais au-dessus de la note maximale (plafond) du plat quand il y en a une. Une « note imposée » se recopie telle quelle.

COMMENTAIRE (montré au client)
- une seule phrase de ${MOTS_MIN} à ${MOTS_MAX} mots (vise 15 à 20), en français, sans guillemets ;
- dit pourquoi l'accord fonctionne, par la cause (acidité, gras, sel, texture, arômes…), jamais par un adjectif creux ;
- cite au moins un élément propre au vin : son cépage, son terroir, son élevage, son dosage ou son producteur ;
- est positif : il dit ce qui fonctionne, jamais ce qui ne fonctionne pas ;
- ne cite ni note, ni classement, ni principe.
Varie les angles d'un vin à l'autre : texture, écho aromatique, structure, origine, moment du repas. Deux commentaires d'un même plat ne commencent jamais de la même façon et ne se ressemblent pas.
Mots et tournures interdits, sous toutes leurs formes : ${MOTS_INTERDITS.map(([m]) => `« ${m} »`).join(', ')}.
Vin noté 2/5 ou moins : le commentaire dit ce que le vin a de beau et nomme le plat de la carte (indiqué) sur lequel il s'exprimera mieux.

LIMITE (interne, jamais montrée au client)
En quelques mots, ce qui empêche une note plus haute sur ce plat ; null si la note est 5. C'est là, et seulement là, que tu peux être critique.

CARTE DES VINS DU RESTAURANT (code | couleur | vin — producteur | millésime | format | prix | cépages | profil | …)
${texteCarte(carte)}

Réponds uniquement avec un tableau JSON, sans texte autour, un objet par vin demandé, dans l'ordre :
[{"vin": "L-B02", "note": 4, "commentaire": "…", "limite": "…"}]`;
}

function lireJson(texte: string): Reponse[] {
  const debut = texte.indexOf('['), fin = texte.lastIndexOf(']');
  if (debut < 0 || fin < debut) throw new Error('réponse de Pat sans tableau JSON');
  return (JSON.parse(texte.slice(debut, fin + 1)) as unknown[]).flatMap((x) => {
    const o = x as Record<string, unknown>;
    return typeof o?.vin === 'string' && typeof o?.commentaire === 'string'
      ? [{ vin: o.vin, note: Number(o.note), commentaire: o.commentaire.trim(), limite: typeof o.limite === 'string' && o.limite.trim() ? o.limite.trim() : null }]
      : [];
  });
}

export async function regenererAccordsPlat(q: Requete, client: Anthropic, restaurantId: string, platId: string, modele: string): Promise<Bilan> {
  const [plat] = await q<PlatCtx & { nom_court: string | null }>(
    `select pl.id, pl.nom, pl.nom_court, pl.categorie::text as categorie, pl.description_cuisine, coalesce(pa.ancrages, '{}') as ancrages, pa.profil,
            coalesce(pa.couleurs_ok::text[], '{}') as couleurs_ok, coalesce(pa.cepages_conseilles, '{}') as cepages_conseilles,
            pa.a_eviter, pa.temperature_service, coalesce(pa.principes, '{}') as principes, pa.plafond
       from plat pl left join profil_accord pa on pa.plat_id = pl.id where pl.id = $1 and pl.restaurant_id = $2`, [platId, restaurantId]);
  if (!plat) throw new Error('plat introuvable');
  const [principes, regles, carte, actuels, autres] = await Promise.all([
    q<PrincipeCtx>(`select id, numero, titre, regle, role, statut::text from principe where statut <> 'retire'`),
    q<RegleCtx>(`select type::text, portee::text, cible, valeur, texte from regle_sommelier where restaurant_id = $1 and actif
                  and (date_debut is null or date_debut <= current_date) and (date_fin is null or date_fin >= current_date) order by priorite`, [restaurantId]),
    // Les rankings ne servent pas à noter un accord (ils comptent à part, dans le classement) : non transmis.
    q<VinGen>(`select v.id, v.couleur::text, v.libelle, coalesce(p.nom, v.producteur_texte) as producteur, v.millesime, v.format,
                      v.prix::float as prix, v.prix_verre::float as prix_verre, v.cepages, v.profil_degustation as profil,
                      null::int as ranking_producteur, p.avis_pat, v.coup_de_coeur,
                      split_part(coalesce(v.vin_texte, ''), ' – ', 1) as appellation, v.ordre
                 from vin_carte v left join producteur p on p.id = v.producteur_id
                where v.restaurant_id = $1 and v.disponible order by v.ordre`, [restaurantId]),
    q<AccordActuel>(`select plat_id, vin_id, note, origine::text, statut::text from accord where plat_id = $1`, [platId]),
    // Notes des autres plats : pour dire où un vin faible sur ce plat s'exprimera mieux.
    q<{ vin_id: string; plat: string; note: number }>(
      `select a.vin_id, coalesce(pl.nom_court, pl.nom) as plat, a.note from accord a join plat pl on pl.id = a.plat_id
        where a.restaurant_id = $1 and a.plat_id <> $2 and pl.actif and a.note >= 3 and a.statut <> 'refuse'
        order by a.note desc, pl.ordre`, [restaurantId, platId]),
  ]);
  if (!carte.length) throw new Error('aucun vin disponible sur la carte');

  const parVin = new Map(actuels.map((a) => [a.vin_id, a]));
  const imposee = (vin: string) => { const a = parVin.get(vin); return a?.origine === 'sommelier' && a.note ? a.note : null; };
  const meilleurPlat = (vin: string) => autres.find((a) => a.vin_id === vin)?.plat ?? null;
  const vinsParCode = new Map(carte.map((v) => [v.id, v]));
  const ligneVin = (v: VinGen, defauts?: string[]) => [
    `${v.id} | ${v.libelle}${v.millesime ? ` ${v.millesime}` : ''}`,
    imposee(v.id) ? `note imposée : ${imposee(v.id)}` : null,
    meilleurPlat(v.id) ? `si sa note est 2 ou moins, plat où il s'exprimera mieux : ${meilleurPlat(v.id)}` : null,
    defauts?.length ? `À CORRIGER : ${defauts.join(' ; ')}` : null,
  ].filter(Boolean).join(' | ');

  const systeme = consigneSysteme(principes, regles, carte);
  let jetonsEntree = 0, jetonsSortie = 0;
  async function appeler(contenu: string) {
    const m = await client.messages.stream({
      model: modele, max_tokens: 32000,
      // Principes et carte : identiques pour tous les plats du restaurant, donc mis en cache.
      system: [{ type: 'text', text: systeme, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contenu }],
    }).finalMessage();
    jetonsEntree += m.usage.input_tokens + (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0);
    jetonsSortie += m.usage.output_tokens;
    if (m.stop_reason === 'max_tokens') throw new Error('réponse de Pat coupée (trop longue)');
    return lireJson(m.content.map((b) => (b.type === 'text' ? b.text : '')).join(''));
  }

  // Défauts d'une réponse : note invalide, puis contrôles du commentaire (mots, longueur, vin, plat conseillé, doublons)
  const plafond = plat.plafond ? Number(plat.plafond) : 5;
  const reponses = new Map<string, Reponse>();
  const defautsDe = () => {
    const d = new Map<string, string[]>();
    const aControler: VinAControler[] = [];
    for (const v of carte) {
      const r = reponses.get(v.id);
      if (!r) { d.set(v.id, ['vin absent de la réponse']); continue; }
      const n = imposee(v.id);
      if (n !== null ? r.note !== n : !(Number.isInteger(r.note) && r.note >= 1 && r.note <= plafond)) {
        d.set(v.id, [n !== null ? `la note imposée est ${n}` : `note invalide (entière, de 1 à ${plafond})`]);
      }
      aControler.push({ vin: v.id, note: r.note, commentaire: r.commentaire,
        reperes: [v.cepages ?? '', v.producteur ?? '', v.appellation ?? '', v.libelle].filter(Boolean),
        meilleurPlat: r.note <= 2 ? meilleurPlat(v.id) : null });
    }
    for (const [vin, def] of controlerPlat(aControler)) d.set(vin, [...(d.get(vin) ?? []), ...def]);
    return d;
  };

  for (const r of await appeler(`${textePlat(plat)}\n\nVINS À NOTER ET COMMENTER (${carte.length})\n${carte.map((v) => ligneVin(v)).join('\n')}`)) {
    if (vinsParCode.has(r.vin)) reponses.set(r.vin, r);
  }
  let defauts = defautsDe();
  for (let essai = 1; essai <= CORRECTIONS && defauts.size; essai++) {
    const retenus = carte.filter((v) => reponses.has(v.id) && !defauts.has(v.id)).map((v) => `- ${reponses.get(v.id)!.commentaire}`);
    const fautifs = carte.filter((v) => defauts.has(v.id));
    for (const r of await appeler(`${textePlat(plat)}\n\nCOMMENTAIRES DÉJÀ ÉCRITS POUR CE PLAT (ne pas les répéter, ne pas commencer de la même façon)\n${retenus.join('\n') || '—'}\n\n` +
      `VINS À REPRENDRE (${fautifs.length})\n${fautifs.map((v) => ligneVin(v, defauts.get(v.id))).join('\n')}`)) {
      if (defauts.has(r.vin)) reponses.set(r.vin, r);
    }
    defauts = defautsDe();
  }

  // Écriture : rang = ordre des notes, puis ordre de la carte ; seuls les vins sans défaut sont écrits.
  const valides = carte.filter((v) => !defauts.has(v.id)).map((v) => reponses.get(v.id)!)
    .sort((a, b) => b.note - a.note || vinsParCode.get(a.vin)!.ordre - vinsParCode.get(b.vin)!.ordre);
  // Une seule requête : l'écriture du plat est atomique (tout ou rien).
  if (valides.length) {
    await q(
      `insert into accord (restaurant_id, plat_id, vin_id, note, rang, explication, limite, service, origine, statut,
                           explication_generee_le, regenere_le, calcule_le, valide_le)
       select $1, $2, x.vin, x.note, x.rang, x.explication, x.limite, $3, 'pat', 'valide', now(), now(), now(), now()
         from unnest($4::text[], $5::int[], $6::int[], $7::text[], $8::text[]) as x(vin, note, rang, explication, limite)
       on conflict (plat_id, vin_id) do update set
         note = case when accord.origine = 'sommelier' then accord.note else excluded.note end,
         rang = excluded.rang, explication = excluded.explication, limite = excluded.limite,
         service = coalesce(accord.service, excluded.service),
         statut = case when accord.statut = 'refuse' then accord.statut else 'valide' end,
         valide_le = case when accord.statut = 'refuse' then accord.valide_le else coalesce(accord.valide_le, now()) end,
         explication_generee_le = now(), regenere_le = now(), calcule_le = now()`,
      [restaurantId, platId, plat.temperature_service, valides.map((r) => r.vin), valides.map((r) => r.note), valides.map((_, i) => i + 1),
        valides.map((r) => r.commentaire), valides.map((r) => (r.note === 5 ? null : r.limite))],
    );
  }
  // Rangs du plat : par note, puis ordre de la carte, y compris les accords restés inchangés (comme à l'import).
  await q(
    `update accord a set rang = r.rn
       from (select a2.id, row_number() over (order by a2.note desc nulls last, v.ordre) as rn
               from accord a2 join vin_carte v on v.id = a2.vin_id where a2.plat_id = $1) r
      where a.id = r.id and a.rang is distinct from r.rn`, [platId]);
  return { ecrits: valides.length, imposes: carte.filter((v) => imposee(v.id) !== null).length, aRevoir: [...defauts.keys()], jetonsEntree, jetonsSortie };
}
