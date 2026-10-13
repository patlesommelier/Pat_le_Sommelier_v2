// Plusieurs plats à la même table : Pat choisit les vins en suivant ses principes « plusieurs plats »
// (partir du plat le plus fragile, chercher un point d'ancrage commun…), parmi les vins notés au-dessus du seuil sur tous les plats.
// L'appel à Claude prend 10 à 20 secondes : il se fait en arrière-plan (fonction choisir-table-background) pour que la page
// s'affiche tout de suite (avec les règles de sélection seules), puis se mette à jour quand le choix de Pat est prêt.
// Le choix est gardé (accord_table) : un seul appel par combinaison de plats.
// Sans « server-only » : le calcul est aussi utilisé par la fonction d'arrière-plan. Les rankings sont donnés à Pat
// pour départager, jamais montrés.
import { createHash } from 'node:crypto';
import type { Requete } from './generation/accords';
import { clientClaude, modeleAccords } from './claude';

export interface ChoixTable { vin_id: string; explication: string }
type Candidat = {
  id: string; libelle: string; couleur: string; cepages: string | null; appellation: string | null; prix: number | null;
  ranking_producteur: number | null; notes: Record<string, number>;
};
type PlatTable = { id: string; nom: string; description: string | null };
type Ligne = { plat_id: string; vin_id: string; explication: string | null };
type Principe = { numero: number; titre: string; regle: string };
/** Tout ce qu'il faut pour que Pat choisisse (envoyé à la fonction d'arrière-plan). */
export type DemandeTable = { restaurantId: string; cle: string; plats: PlatTable[]; vins: Candidat[]; lignes: Ligne[]; principes: Principe[] };

const SANS_ACCENTS = (x: string) => `translate(lower(${x}), 'àâäáéèêëíîïóôöúùûüç', 'aaaaeeeeiiiooouuuuc')`;
const EN_COURS = 'en_cours';

/** Principes validés de Pat sur les accords pour plusieurs plats (titre, règle ou étiquettes). */
export async function principesPlusieursPlats(q: Requete) {
  return q<Principe>(
    `select numero, titre, regle from principe
      where statut = 'valide' and ${SANS_ACCENTS("titre || ' ' || regle || ' ' || array_to_string(tags, ' ')")} like '%plusieurs plats%'
      order by numero`);
}

/**
 * Choix de Pat pour ces plats : la liste si elle est prête ; 'en_cours' si Pat y travaille (la demande est lancée au besoin) ;
 * null s'il n'y a rien à demander (pas de principe, moins de deux plats, aucun vin).
 */
export async function choixPourPlusieursPlats(q: Requete, restaurantId: string, plats: PlatTable[], candidats: Candidat[], lignes: Ligne[],
  lancer: (d: DemandeTable) => Promise<void>): Promise<ChoixTable[] | 'en_cours' | null> {
  if (plats.length < 2 || !candidats.length) return null;
  const principes = await principesPlusieursPlats(q);
  if (!principes.length) return null;
  const vins = candidats.slice(0, 12);
  const cle = createHash('sha256').update(JSON.stringify({
    plats: plats.map((p) => [p.id, p.nom, p.description]).sort(),
    vins: vins.map((v) => [v.id, v.libelle, v.notes, v.ranking_producteur]),
    principes: principes.map((p) => [p.numero, p.regle]),
  })).digest('hex');
  const [deja] = await q<{ resultat: ChoixTable[] | string; recent: boolean }>(
    `select resultat, cree_le > now() - interval '2 minutes' as recent from accord_table where restaurant_id = $1 and cle = $2`, [restaurantId, cle]);
  if (deja && Array.isArray(deja.resultat)) return deja.resultat.length ? deja.resultat : null; // [] : échec gardé, règles seules
  if (deja && deja.recent) return EN_COURS;
  // Demande (ou relance d'une demande abandonnée depuis plus de 2 minutes).
  await q(`insert into accord_table (restaurant_id, cle, resultat) values ($1, $2, to_jsonb($3::text))
           on conflict (restaurant_id, cle) do update set resultat = excluded.resultat, cree_le = now()`, [restaurantId, cle, EN_COURS]);
  const nomPlat = new Map(plats.map((p) => [p.id, p.nom]));
  const utiles = lignes.filter((l) => vins.some((v) => v.id === l.vin_id) && nomPlat.has(l.plat_id));
  await lancer({ restaurantId, cle, plats, vins: vins.map(({ id, libelle, couleur, cepages, appellation, prix, ranking_producteur, notes }) =>
    ({ id, libelle, couleur, cepages, appellation, prix, ranking_producteur, notes })), lignes: utiles, principes });
  return EN_COURS;
}

/** L'appel à Pat (Claude) et l'enregistrement du choix : en arrière-plan. En cas d'échec, [] (les règles seules s'appliquent). */
export async function calculerChoixTable(q: Requete, d: DemandeTable) {
  const nomPlat = new Map(d.plats.map((p) => [p.id, p.nom]));
  const pourquoi = (vin: string, plat: string) => d.lignes.find((l) => l.vin_id === vin && l.plat_id === plat)?.explication ?? '';
  const consigne = `Tu es Pat, sommelier. Des clients partagent une bouteille pour plusieurs plats à la même table.
Applique tes principes pour les accords de plusieurs plats :
${d.principes.map((p) => `- ${p.titre} : ${p.regle}`).join('\n')}

Plats choisis :
${d.plats.map((p) => `- ${p.nom}${p.description ? ` (${p.description})` : ''}`).join('\n')}

Vins candidats (tous notés au moins 3/5 sur chaque plat), avec leur note et l'accord avec chaque plat :
${d.vins.map((v) => `[${v.id}] ${v.libelle} · ${v.couleur}${v.cepages ? ` · ${v.cepages}` : ''}${v.appellation ? ` · ${v.appellation}` : ''}${v.prix ? ` · ${v.prix} €` : ''}${v.ranking_producteur != null ? ` · producteur ${v.ranking_producteur}/5` : ''}
${d.plats.map((p) => `    ${nomPlat.get(p.id)} : ${v.notes[p.id]}/5 — ${pourquoi(v.id, p.id)}`).join('\n')}`).join('\n')}

Classe ces vins du meilleur au moins bon pour l'ensemble de la table (9 au plus ; écarte ceux qui se brisent sur un plat).
Pour chacun, écris en 2 phrases au plus, au client, pourquoi il tient tous ces plats (le plat le plus fragile, le point d'ancrage commun).
Ne parle jamais de notes, de score ni de classement des producteurs. Pas de contenant (bouteille, verre).
Réponds uniquement en JSON, sans texte autour : [{"vin": "identifiant", "pourquoi": "..."}]`;
  let resultat: ChoixTable[] = [];
  try {
    const m = await clientClaude({ maxRetries: 2 }).messages.create({ model: modeleAccords(), max_tokens: 2500, messages: [{ role: 'user', content: consigne }] });
    const texte = m.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const brut = JSON.parse(texte.slice(texte.indexOf('['), texte.lastIndexOf(']') + 1)) as { vin?: unknown; pourquoi?: unknown }[];
    const ids = new Set(d.vins.map((v) => v.id));
    for (const x of brut) {
      if (typeof x.vin !== 'string' || !ids.has(x.vin) || resultat.some((r) => r.vin_id === x.vin)) continue;
      resultat.push({ vin_id: x.vin, explication: typeof x.pourquoi === 'string' ? x.pourquoi.trim() : '' });
    }
  } catch (e) {
    console.error('[plusieurs plats]', d.restaurantId, e);
    resultat = [];
  }
  await q(`insert into accord_table (restaurant_id, cle, resultat) values ($1, $2, $3)
           on conflict (restaurant_id, cle) do update set resultat = excluded.resultat, cree_le = now()`,
    [d.restaurantId, d.cle, JSON.stringify(resultat)]);
  return resultat;
}
