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

/** Nombre de propositions par plat : règle « nombre_propositions » du sommelier, 2 par défaut. */
async function nombrePropositions(restaurantId: string) {
  const [r] = await requete<{ valeur: string | null }>(
    `select valeur from regle_sommelier where restaurant_id = $1 and type = 'nombre_propositions' and actif order by priorite limit 1`,
    [restaurantId],
  );
  const n = Number(r?.valeur);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

/** Note minimale pour qu'un accord soit proposé au client (3 = « correct »). */
const NOTE_MINIMALE = 3;

/** Meilleurs accords d'un plat (note puis rang du sommelier), avec les vins disponibles correspondants. */
export async function getPropositions(restaurantId: string, platId: string) {
  const n = await nombrePropositions(restaurantId);
  const lignes = await requete<Accord & Vin>(
    `select a.plat_id, a.vin_id, a.note, a.rang, a.explication, a.explication_longue, a.service, a.statut, v.*
       from accord a
       join (${SELECT_VIN}) v on v.id = a.vin_id
      where a.plat_id = $1 and a.statut = any($2) and a.note >= $3
        and exists (select 1 from vin_carte d where d.id = a.vin_id and d.disponible)
      order by a.note desc, a.rang nulls last
      limit $4`,
    [platId, accordsVisibles(), NOTE_MINIMALE, n * 4],
  );
  // Un même vin en plusieurs formats (37,5 cl et 75 cl) n'occupe qu'une place : on garde le premier.
  const vus = new Set<string>();
  lignes.sort((x, y) => (y.note ?? 0) - (x.note ?? 0) || Number(x.format !== '75 cl') - Number(y.format !== '75 cl') || (x.rang ?? 99) - (y.rang ?? 99));
  const uniques = lignes.filter((l) => !vus.has(l.libelle) && vus.add(l.libelle)).slice(0, n);
  return uniques.map((l) => ({
    accord: { plat_id: l.plat_id, vin_id: l.vin_id, note: l.note, rang: l.rang, explication: l.explication, explication_longue: l.explication_longue, service: l.service, statut: l.statut } as Accord,
    vin: l as Vin,
  }));
}

export async function getAccord(platId: string, vinId: string) {
  const [a] = await requete<Accord>(
    `select plat_id, vin_id, note, rang, explication, explication_longue, service, statut
       from accord where plat_id = $1 and vin_id = $2 and statut = any($3)`,
    [platId, vinId, accordsVisibles()],
  );
  return a ?? null;
}
