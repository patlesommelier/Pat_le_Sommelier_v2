import 'server-only';
import { cache } from 'react';
import { requete } from './db';
import type { Accord, Plat, Restaurant, Vin } from './types';

const accordsVisibles = () =>
  process.env.AFFICHER_ACCORDS_PROPOSES === 'true' ? ['valide', 'propose'] : ['valide'];

export const getRestaurant = cache(async (id: string) => {
  const [r] = await requete<Restaurant>(
    'select id, nom, couleur, couleur_claire, logo_url, accroche from restaurant where id = $1',
    [id],
  );
  return r ?? null;
});

export async function getPlats(restaurantId: string) {
  return requete<Plat>(
    `select id, nom, nom_court, categorie, prix::float as prix, prix_variantes
       from plat where restaurant_id = $1 and actif order by ordre`,
    [restaurantId],
  );
}

export async function getPlat(id: string) {
  const [p] = await requete<Plat>(
    'select id, nom, nom_court, categorie, prix::float as prix, prix_variantes from plat where id = $1 and actif',
    [id],
  );
  return p ?? null;
}

const SELECT_VIN = `
  select v.id, v.couleur, v.section, v.libelle, v.producteur_texte, v.millesime, v.format,
         v.prix::float as prix, v.prix_verre::float as prix_verre, v.cepages, v.profil_degustation,
         v.descriptif, v.presentation, v.vin_texte, v.resume_court, v.etiquette_url, v.coup_de_coeur,
         p.nom as producteur_nom, p.avis_pat as producteur_avis_pat, p.ranking_pat as producteur_ranking,
         t.nom as appellation_nom
    from vin_carte v
    left join producteur p on p.id = v.producteur_id
    left join terroir t on t.id = v.appellation_id`;

export async function getCarte(restaurantId: string) {
  return requete<Vin>(`${SELECT_VIN} where v.restaurant_id = $1 and v.disponible order by v.ordre`, [restaurantId]);
}

export async function getVin(restaurantId: string, id: string) {
  const [v] = await requete<Vin>(`${SELECT_VIN} where v.restaurant_id = $1 and v.id = $2`, [restaurantId, id]);
  return v ?? null;
}

/** Accords à afficher pour un plat, avec les vins correspondants, dans l'ordre du sommelier. */
export async function getPropositions(platId: string) {
  const accords = await requete<Accord>(
    `select plat_id, vin_id, note, rang, explication, explication_longue, service, statut
       from accord where plat_id = $1 and statut = any($2) order by rang nulls last, note desc nulls last`,
    [platId, accordsVisibles()],
  );
  if (!accords.length) return [];
  const vins = await requete<Vin>(`${SELECT_VIN} where v.id = any($1) and v.disponible`, [accords.map((a) => a.vin_id)]);
  return accords
    .map((a) => ({ accord: a, vin: vins.find((v) => v.id === a.vin_id) }))
    .filter((x): x is { accord: Accord; vin: Vin } => Boolean(x.vin));
}

export async function getAccord(platId: string, vinId: string) {
  const [a] = await requete<Accord>(
    `select plat_id, vin_id, note, rang, explication, explication_longue, service, statut
       from accord where plat_id = $1 and vin_id = $2 and statut = any($3)`,
    [platId, vinId, accordsVisibles()],
  );
  return a ?? null;
}
