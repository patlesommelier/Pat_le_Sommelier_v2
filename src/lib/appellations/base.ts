import 'server-only';
// Appellations (terroirs) de la base de Pat : liste du super-admin, appellations saisies à valider, regroupement des doublons.
import { requete } from '../db';
import { appellationProche, cleAppellation, doublons } from './regroupement';
import { creerAppellationProposeeAvec } from './creation';

export interface Appellation {
  id: string; nom: string; type: string | null; niveau: string; region: string | null; pays: string | null; ranking_pat: number | null;
  statut: 'valide' | 'propose' | 'retire'; source: string | null; vins_base: number; vins_cartes: number; producteurs: number; fusionne_dans_nom: string | null;
}

const COMPTES = `(select count(*)::int from cuvee c where c.appellation_id = t.id and c.statut <> 'retire') as vins_base,
  (select count(*)::int from vin_carte v where v.appellation_id = t.id) as vins_cartes,
  (select count(*)::int from producteur_terroir pt where pt.terroir_id = t.id) as producteurs`;

export const PAR_PAGE = 100;

/** Liste filtrée (recherche, statut, niveau), les appellations à valider d'abord. */
export async function listeAppellations({ texte = '', statut = '', niveau = '', page = 1 }: { texte?: string; statut?: string; niveau?: string; page?: number }) {
  const mots = cleAppellation(texte).split(' ').filter(Boolean).map((m) => `%${m}%`);
  const filtre = `(cardinality($1::text[]) = 0 or translate(lower(t.nom || ' ' || coalesce(t.region, '')), 'àâäáãéèêëíìîïóòôöõúùûüçñœ-''', 'aaaaaeeeeiiiiooooouuuucno  ') like all($1))
    and ($2 = '' or t.statut::text = $2) and ($3 = '' or t.niveau = $3)`;
  const [lignes, [{ total }]] = await Promise.all([
    requete<Appellation>(
      `select t.id, t.nom, t.type, t.niveau, t.region, t.pays, t.ranking_pat, t.statut::text as statut, t.source, ${COMPTES},
              (select f.nom from terroir f where f.id = t.fusionne_dans) as fusionne_dans_nom
         from terroir t where ${filtre}
        order by t.statut = 'propose' desc, t.statut = 'retire', lower(t.nom) limit ${PAR_PAGE} offset $4`,
      [mots, statut, niveau, (page - 1) * PAR_PAGE]),
    requete<{ total: number }>(`select count(*)::int as total from terroir t where ${filtre}`, [mots, statut, niveau]),
  ]);
  return { lignes, total };
}

export async function compteAValider() {
  const [{ n }] = await requete<{ n: number }>(`select count(*)::int as n from terroir where statut = 'propose'`);
  return n;
}

/** Doublons probables (noms proches, même région) parmi les appellations non retirées. */
export async function doublonsProbables() {
  const toutes = await requete<{ id: string; nom: string; statut: string; region: string | null; niveau: string; vins: number }>(
    `select t.id, t.nom, t.statut::text as statut, t.region, t.niveau,
            (select count(*)::int from cuvee c where c.appellation_id = t.id) + (select count(*)::int from vin_carte v where v.appellation_id = t.id) as vins
       from terroir t where t.statut <> 'retire'`);
  return doublons(toutes);
}

/** Appellations écrites sur des vins (base ou cartes) mais reliées à aucune appellation de la base ; avec la plus proche, s'il y en a une. */
export async function saisiesNonReliees() {
  const saisies = await requete<{ texte: string; vins_base: number; vins_cartes: number }>(
    `select texte, sum(base)::int as vins_base, sum(cartes)::int as vins_cartes from (
       select trim(appellation_texte) as texte, 1 as base, 0 as cartes from cuvee where appellation_id is null and statut <> 'retire' and coalesce(trim(appellation_texte), '') <> ''
       union all
       select trim(appellation_texte), 0, 1 from vin_carte where appellation_id is null and coalesce(trim(appellation_texte), '') <> '') x
      group by texte order by sum(base) + sum(cartes) desc, texte limit 200`);
  if (!saisies.length) return [];
  const base = await requete<{ id: string; nom: string; statut: string }>(`select id, nom, statut::text from terroir where statut <> 'retire'`);
  return saisies.map((s) => ({ ...s, proche: appellationProche(s.texte, base) }));
}

/** Nouvelle appellation, à valider (saisie dans la fiche d'un vin, ou ajoutée depuis la liste) ; renvoie son identifiant (l'existante si même nom). */
export const creerAppellationProposee = (nom: string, region: string | null = null, source = 'saisie') =>
  creerAppellationProposeeAvec(requete, nom, source, region);

/** Vins (base et cartes) dont l'appellation écrite est ce texte, et qui n'en ont pas encore : reliés à cette appellation. */
export async function relierSaisie(texte: string, terroirId: string) {
  const [t] = await requete<{ ranking_pat: number | null }>('select ranking_pat from terroir where id = $1', [terroirId]);
  if (!t) return 0;
  const a = await requete(`update cuvee set appellation_id = $2 where appellation_id is null and trim(appellation_texte) = $1 returning id`, [texte, terroirId]);
  const b = await requete(`update vin_carte set appellation_id = $2, ranking_terroir = coalesce($3, ranking_terroir)
                            where appellation_id is null and trim(appellation_texte) = $1 returning id`, [texte, terroirId, t.ranking_pat]);
  return a.length + b.length;
}

/**
 * Regroupe des appellations dans celle à garder : vins de la base et des cartes, producteurs et sous-terroirs passent sur elle ;
 * les autres sont retirées, avec la trace de celle qui les remplace. Renvoie le nombre de vins déplacés.
 */
export async function regrouperAppellations(cibleId: string, sourceIds: string[]) {
  const sources = sourceIds.filter((s) => s && s !== cibleId);
  const [cible] = await requete<{ ranking_pat: number | null }>(`select ranking_pat from terroir where id = $1 and statut <> 'retire'`, [cibleId]);
  if (!cible || !sources.length) return 0;
  // Vins de la base : l'appellation écrite suit (« Sancere » devient « Sancerre ») ; les vins des cartes gardent ce que le restaurant a écrit.
  const a = await requete(
    `update cuvee c set appellation_id = $1,
            appellation_texte = case when trim(c.appellation_texte) in (select nom from terroir where id = any($2)) then (select nom from terroir where id = $1) else c.appellation_texte end
      where c.appellation_id = any($2) returning c.id`, [cibleId, sources]);
  const b = await requete(`update vin_carte set appellation_id = $1, ranking_terroir = coalesce($3, ranking_terroir) where appellation_id = any($2) returning id`,
    [cibleId, sources, cible.ranking_pat]);
  await requete(`insert into producteur_terroir (producteur_id, terroir_id) select producteur_id, $1 from producteur_terroir where terroir_id = any($2) on conflict do nothing`, [cibleId, sources]);
  await requete(`delete from producteur_terroir where terroir_id = any($1)`, [sources]);
  await requete(`update terroir set parent_id = $1 where parent_id = any($2) and id <> $1`, [cibleId, sources]);
  await requete(`update terroir set statut = 'retire', fusionne_dans = $1, maj_le = now() where id = any($2)`, [cibleId, sources]);
  return a.length + b.length;
}
