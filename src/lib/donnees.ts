import 'server-only';
import { cache } from 'react';
import { requete } from './db';
import { selectionner, tourSuivant, type Motif, type Retenu } from './selection';
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
         v.ordre, v.ranking_producteur, v.ranking_terroir, v.pays,
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

/** Vins que le sommelier a retirés des propositions (règle ponctuelle « exclure », portée « vin »). */
async function vinsExclus(restaurantId: string) {
  const r = await requete<{ cible: string }>(
    `select cible from regle_sommelier
      where restaurant_id = $1 and type = 'exclure' and portee = 'vin' and actif
        and (date_debut is null or date_debut <= current_date) and (date_fin is null or date_fin >= current_date)`,
    [restaurantId],
  );
  return new Set(r.map((x) => x.cible));
}

export interface Proposition { accord: Accord; vin: Vin; motif: Motif }

/**
 * Propositions pour un plat, selon les règles de sélection du restaurant (regles_selection.xlsx, V7 — voir selection.ts).
 * tour = 1 : la liste de 1 à 5 vins ; tour = 2, 3… : les trois vins suivants du classement.
 */
export async function getPropositions(restaurantId: string, platId: string, tour = 1): Promise<{ propositions: Proposition[]; encore: boolean }> {
  const [lignes, exclus] = await Promise.all([
    requete<Accord & Vin>(
      `select a.plat_id, a.vin_id, a.note, a.rang, a.explication, a.explication_longue, a.service, a.statut, v.*
         from accord a
         join (${SELECT_VIN} where v.disponible) v on v.id = a.vin_id
        where a.plat_id = $1 and a.restaurant_id = $2 and a.statut = any($3) and a.note is not null`,
      [platId, restaurantId, accordsVisibles()],
    ),
    vinsExclus(restaurantId),
  ]);
  const parId = new Map(lignes.filter((l) => !exclus.has(l.vin_id)).map((l) => [l.vin_id, l]));
  const candidats = [...parId.values()].map((l) => ({
    ...l,
    id: l.vin_id,
    prix: l.prix ?? null,
    appellation: String(l.vin_texte ?? '').split(' – ')[0].replace(/\(.*?\)/g, '').trim(),
    notes: { [platId]: Number(l.note) },
  }));
  const sel = selectionner(candidats, [platId]);
  let liste: Retenu<(typeof candidats)[number]>[] = sel.liste;
  const proposes = sel.liste.map((r) => r.vin.id);
  for (let t = 2; t <= tour; t++) {
    liste = tourSuivant(sel, proposes);
    proposes.push(...liste.map((r) => r.vin.id));
  }
  const encore = tourSuivant(sel, proposes, 1).length > 0;
  const propositions = liste.map((r) => {
    const l = parId.get(r.vin.id)!;
    return {
      accord: { plat_id: l.plat_id, vin_id: l.vin_id, note: l.note, rang: l.rang, explication: l.explication, explication_longue: l.explication_longue, service: l.service, statut: l.statut } as Accord,
      vin: l as Vin,
      motif: r.motif,
    };
  });
  return { propositions, encore };
}

export async function getAccord(platId: string, vinId: string) {
  const [a] = await requete<Accord>(
    `select plat_id, vin_id, note, rang, explication, explication_longue, service, statut
       from accord where plat_id = $1 and vin_id = $2 and statut = any($3)`,
    [platId, vinId, accordsVisibles()],
  );
  return a ?? null;
}
