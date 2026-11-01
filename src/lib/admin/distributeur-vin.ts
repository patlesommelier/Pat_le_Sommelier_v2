import 'server-only';
// Vin d'un restaurant acheté chez un distributeur de Quid Vinum : le distributeur devient son fournisseur
// (avec la marge par défaut s'il ne l'était pas), le vin y est rattaché avec son prix d'achat (prix du restaurant, HTVA).
import { randomUUID } from 'node:crypto';
import { requete } from '@/lib/db';
import { offresDistributeurs } from '@/lib/admin/recherche-base';
import { margeDefaut } from '@/lib/distributeurs/donnees';

export async function rattacherAuDistributeur(resto: string, vinIds: string[], offreId: string) {
  const [o] = await offresDistributeurs(resto, { vins: [offreId] });
  if (!o || !vinIds.length) return null;
  await requete(`insert into fournisseur (id, restaurant_id, nom, distributeur_id, marge) select $1, $2, $3, $4, $5
                  where not exists (select 1 from fournisseur where restaurant_id = $2 and distributeur_id = $4)`,
    [randomUUID(), resto, o.distributeur, o.distributeur_id, await margeDefaut()]);
  const [f] = await requete<{ id: string }>('select id from fournisseur where restaurant_id = $1 and distributeur_id = $2 limit 1', [resto, o.distributeur_id]);
  await requete(`update vin_carte set fournisseur_id = $3, distributeur_vin_id = $4, prix_achat = coalesce($5, prix_achat) where restaurant_id = $1 and id = any($2)`,
    [resto, vinIds, f?.id ?? null, o.id, o.prix]);
  return { ...o, fournisseur_id: f?.id ?? null };
}

/**
 * Vins de la carte vendus par un distributeur de Quid Vinum (par leur vin de la base), quand ce distributeur n'est pas déjà
 * leur fournisseur : la meilleure offre de chacun, au prix du restaurant. Jamais le prix QV ni la marge.
 */
export async function offresPourLaCarte(resto: string) {
  const vins = await requete<{ id: string; cuvee_id: string; distributeur_id: string | null }>(
    `select v.id, v.cuvee_id, f.distributeur_id from vin_carte v left join fournisseur f on f.id = v.fournisseur_id
      where v.restaurant_id = $1 and v.cuvee_id is not null`, [resto]);
  if (!vins.length) return new Map<string, Awaited<ReturnType<typeof offresDistributeurs>>[number]>();
  const offres = await offresDistributeurs(resto, { cuvees: [...new Set(vins.map((v) => v.cuvee_id))] });
  const parVin = new Map<string, (typeof offres)[number]>();
  for (const v of vins) {
    if (v.distributeur_id) continue; // déjà acheté chez un distributeur de Quid Vinum
    const o = offres.filter((x) => x.cuvee_id === v.cuvee_id && !x.epuise && x.prix != null).sort((a, b) => a.prix! - b.prix!)[0];
    if (o) parVin.set(v.id, o);
  }
  return parVin;
}
