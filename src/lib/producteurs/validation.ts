/**
 * Validation des producteurs proposés (écran super-admin « Producteurs à valider »).
 * Un producteur repéré sur une carte arrive « proposé » : le restaurant voit « Nouveau producteur ».
 * À la validation, Pat fixe son ranking (et celui des terroirs de ses vins) : les vins des cartes qui le citent
 * passent en « Déjà référencé » et reprennent ces rankings, ce qui les reclasse aussitôt (le classement est
 * calculé à chaque affichage ; les notes d'accord ne changent pas).
 * Côté serveur uniquement ; pas d'import « server-only » : testable seul.
 */
import type { Requete } from '../generation/accords';

const ranking = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 5;

export interface Fiche { nom?: string; pays?: string | null; region?: string | null; notes_objectives?: string | null }

export async function validerProducteur(q: Requete, { producteurId, rankingProducteur, terroirs = [], fiche = {}, par }:
  { producteurId: string; rankingProducteur: number; terroirs?: { terroirId: string; rankingTerroir: number }[]; fiche?: Fiche; par: string }) {
  const erreurs: string[] = [];
  if (!ranking(rankingProducteur)) erreurs.push('Ranking du producteur : entier de 0 à 5.');
  for (const t of terroirs) if (!ranking(t.rankingTerroir)) erreurs.push(`Ranking du terroir ${t.terroirId} : entier de 0 à 5.`);
  if (erreurs.length) return { erreurs, restaurants: [] as string[], vins: 0 };

  const [p] = await q<{ id: string }>(
    `update producteur set statut = 'valide', ranking_pat = $2, valide_par = $3, valide_le = now(), motif_rejet = null, maj_le = now(),
            nom = coalesce($4, nom), pays = coalesce($5, pays), region = coalesce($6, region), notes_objectives = coalesce($7, notes_objectives)
      where id = $1 returning id`,
    [producteurId, rankingProducteur, par, fiche.nom?.trim() || null, fiche.pays?.trim() || null, fiche.region?.trim() || null, fiche.notes_objectives?.trim() || null]);
  if (!p) return { erreurs: ['Producteur introuvable.'], restaurants: [], vins: 0 };
  for (const t of terroirs) {
    await q(`update terroir set ranking_pat = $2, statut = 'valide', maj_le = now() where id = $1`, [t.terroirId, t.rankingTerroir]);
  }
  // Vins des cartes : ranking du producteur, et celui du terroir quand Pat vient de le fixer.
  const vins = await q<{ restaurant_id: string }>(
    `update vin_carte v set ranking_producteur = $2,
            ranking_terroir = coalesce((select t.rank from unnest($3::text[], $4::int[]) as t(id, rank) where t.id = v.appellation_id), v.ranking_terroir)
      where v.producteur_id = $1 returning v.restaurant_id`,
    [producteurId, rankingProducteur, terroirs.map((t) => t.terroirId), terroirs.map((t) => t.rankingTerroir)]);
  return { erreurs: [], restaurants: [...new Set(vins.map((v) => v.restaurant_id))], vins: vins.length };
}

/** Rejet : le producteur sort de la file ; ses vins restent sur les cartes, « Nouveau producteur », sans ranking ajouté. */
export async function rejeterProducteur(q: Requete, { producteurId, motif = '', par }: { producteurId: string; motif?: string; par: string }) {
  await q(`update producteur set statut = 'retire', motif_rejet = $2, valide_par = $3, valide_le = now(), maj_le = now() where id = $1`,
    [producteurId, motif.trim() || null, par]);
}
