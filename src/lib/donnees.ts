import 'server-only';
import { cache } from 'react';
import { requete } from './db';
import { avecAppreciation } from './appreciation';
import { parametresEnService } from './regles/versions';
import { reglagesComplets, selectionner, tourSuivant, type Candidat, type Motif, type Reglages, type Retenu } from './selection';
import type { Accord, Plat, Restaurant, Vin } from './types';

export const accordsVisibles = () =>
  process.env.AFFICHER_ACCORDS_PROPOSES === 'true' ? ['valide', 'propose'] : ['valide'];

export const getRestaurant = cache(async (id: string) => {
  const [r] = await requete<Restaurant>(
    'select id, nom, couleur, couleur_claire, logo_url, logo_fonce_url, accroche, statut, origine, logo_ratio, logo_fonce_ratio, logo_choix from restaurant where id = $1',
    [id],
  );
  return r ?? null;
});

export async function getPlats(restaurantId: string) {
  return requete<Plat>(
    // Un plat sans aucun accord (pas encore généré, ou en échec) n'est pas montré au client.
    `select id, nom, nom_court, categorie, prix::float as prix, prix_variantes
       from plat where restaurant_id = $1 and actif and exists (select 1 from accord a where a.plat_id = plat.id)
      order by ordre`,
    [restaurantId],
  );
}

export async function getPlat(id: string) {
  const [p] = await requete<Plat>(
    `select id, nom, nom_court, categorie, prix::float as prix, prix_variantes from plat
      where id = $1 and actif and exists (select 1 from accord a where a.plat_id = plat.id)`,
    [id],
  );
  return p ?? null;
}

const SELECT_VIN = `
  select v.id, v.couleur, v.section, v.libelle, v.producteur_texte, v.millesime, v.format,
         v.prix::float as prix, v.prix_verre::float as prix_verre, v.cepages, v.profil_degustation,
         v.descriptif, v.vin_texte,
         -- Texte montré au client : celui du restaurant, sinon la présentation de la base, sinon celle écrite par Pat
         coalesce(v.presentation_carte_perso, v.presentation, v.presentation_carte) as presentation, v.resume_court, v.etiquette_url, v.coup_de_coeur,
         v.ordre, v.ranking_producteur, v.ranking_terroir, v.pays,
         -- Nom saisi dans le back-office prioritaire sur celui de la base de Pat
         case when v.modifie_bo is not null and v.producteur_texte is not null then v.producteur_texte else p.nom end as producteur_nom,
         p.avis_pat as producteur_avis_pat, p.ranking_pat as producteur_ranking,
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
export async function vinsExclus(restaurantId: string) {
  const r = await requete<{ cible: string }>(
    `select cible from regle_sommelier
      where restaurant_id = $1 and type = 'exclure' and portee = 'vin' and actif
        and (date_debut is null or date_debut <= current_date) and (date_fin is null or date_fin >= current_date)`,
    [restaurantId],
  );
  return new Set(r.map((x) => x.cible));
}

export interface Proposition { accord: Accord; vin: Vin; motif: Motif }

/** Réglages des règles de sélection du restaurant (back-office), complétés par les valeurs de Pat. */
export async function getReglages(restaurantId: string): Promise<Reglages> {
  const [[r], base] = await Promise.all([
    requete<{ reglages_selection: unknown }>('select reglages_selection from restaurant where id = $1', [restaurantId]),
    parametresEnService(requete),
  ]);
  // Ajustements du restaurant par-dessus les règles de Pat en service.
  return reglagesComplets(r?.reglages_selection, base);
}

export type LigneAccord = Accord & Vin;
export type CandidatVin = LigneAccord & Candidat;

/**
 * Vins candidats pour un ou plusieurs plats : vins disponibles, non retirés, avec leur note d'accord sur chaque plat.
 * `statuts` : statuts d'accord pris en compte (par défaut ceux montrés au client).
 */
export async function getCandidats(restaurantId: string, platIds: string[], statuts = accordsVisibles()) {
  const [lignes, exclus] = await Promise.all([
    requete<LigneAccord>(
      `select a.plat_id, a.vin_id, a.note, a.rang, a.explication, a.explication_longue, a.service, a.statut, a.commentaire_sommelier, v.*
         from accord a
         join (${SELECT_VIN} where v.disponible) v on v.id = a.vin_id
        where a.plat_id = any($1) and a.restaurant_id = $2 and a.statut = any($3) and a.note is not null`,
      [platIds, restaurantId, statuts],
    ),
    vinsExclus(restaurantId),
  ]);
  const parVin = new Map<string, CandidatVin>();
  const lignesParVin = new Map<string, LigneAccord[]>();
  for (const l of lignes) {
    if (exclus.has(l.vin_id)) continue;
    lignesParVin.set(l.vin_id, [...(lignesParVin.get(l.vin_id) ?? []), l]);
    const c = parVin.get(l.vin_id) ?? {
      ...l,
      id: l.vin_id,
      prix: l.prix ?? null,
      appellation: String(l.vin_texte ?? '').split(' – ')[0].replace(/\(.*?\)/g, '').trim(),
      notes: {},
    };
    c.notes[l.plat_id] = Number(l.note);
    parVin.set(l.vin_id, c);
  }
  return { candidats: [...parVin.values()], lignesParVin, exclus };
}

/**
 * Propositions pour un plat, selon les règles de sélection du restaurant (regles_selection.xlsx, V7 — voir selection.ts),
 * ajustées par ses réglages. tour = 1 : la liste de 1 à 5 vins ; tour = 2, 3… : les vins suivants du classement.
 */
export async function getPropositions(restaurantId: string, platId: string, tour = 1): Promise<{ propositions: Proposition[]; encore: boolean }> {
  const [{ candidats, lignesParVin }, R] = await Promise.all([getCandidats(restaurantId, [platId]), getReglages(restaurantId)]);
  const sel = selectionner(candidats, [platId], { reglages: R });
  let liste: Retenu<CandidatVin>[] = sel.liste;
  const proposes = sel.liste.map((r) => r.vin.id);
  for (let t = 2; t <= tour; t++) {
    liste = tourSuivant(sel, proposes, R.tourSuivant, R.diversite, R.plafondBulles);
    proposes.push(...liste.map((r) => r.vin.id));
  }
  const encore = tourSuivant(sel, proposes, 1, R.diversite, R.plafondBulles).length > 0;
  const propositions = liste.map((r, i) => {
    const l = lignesParVin.get(r.vin.id)![0];
    // Appréciation selon la note (« c’est un très joli accord »), variée d'un vin à l'autre ; jamais sur un texte du restaurant.
    const app = { cle: `${l.plat_id}|${tour}`, position: i, ecritParLeRestaurant: Boolean(l.commentaire_sommelier) };
    return {
      accord: { plat_id: l.plat_id, vin_id: l.vin_id, note: l.note, rang: l.rang, explication: avecAppreciation(l.explication, l.note, app),
        explication_longue: avecAppreciation(l.explication_longue, l.note, app), service: l.service, statut: l.statut } as Accord,
      vin: l as Vin,
      motif: r.motif,
    };
  });
  return { propositions, encore };
}

export async function getAccord(platId: string, vinId: string) {
  const [a] = await requete<Accord>(
    `select plat_id, vin_id, note, rang, explication, explication_longue, service, statut, commentaire_sommelier
       from accord where plat_id = $1 and vin_id = $2 and statut = any($3)`,
    [platId, vinId, accordsVisibles()],
  );
  return a ?? null;
}
