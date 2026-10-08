/**
 * Publication des principes et des règles de Pat (« Publier les principes », « Publier les règles »), en deux temps :
 *  1. préparer : tout est recalculé avec le brouillon sans rien mettre en ligne, et les changements visibles par le client
 *     sont listés plat par plat (vins qui entrent, qui sortent, notes qui changent) ;
 *  2. confirmer : les nouveaux accords sont écrits et le brouillon passe en service — refusé si le brouillon a changé
 *     depuis la préparation. Les notes changées à la main et les commentaires réécrits par un restaurant sont conservés.
 * Principes : Pat note à nouveau chaque plat (file publication_plat, traitée en arrière-plan comme les régénérations).
 * Règles : pas d'appel au modèle, le calcul est immédiat.
 * Côté serveur uniquement ; pas d'import « server-only » : utilisé aussi par la fonction Netlify d'arrière-plan.
 */
import Anthropic from '@anthropic-ai/sdk';
import { regenererAccordsPlat, type Requete } from '../generation/accords';
import { valider as validerPrincipes } from '../principes/format';
import { brouillon as brouillonPrincipes, principesPourGeneration, synchroniserPrincipes } from '../principes/versions';
import { brouillonRegles, parametresEnService, validerParametres } from '../regles/versions';
import { reglagesComplets, selectionner, type Candidat, type Reglages } from '../selection';
import { clientClaude, modeleAccords } from '../claude';

export type TypePublication = 'principes' | 'regles';
export interface Changements { entrent: string[]; sortent: string[]; notes: { vin: string; avant: number; apres: number }[] }

const BLOQUE_APRES = '20 minutes';

// ─── Sélection d'un plat (même calcul que l'app, sans passer par les modules réservés à Next) ───

interface LigneCandidat extends Omit<Candidat, 'notes'> { note: number; origine: string; statut: string }

async function candidatsPlat(q: Requete, restaurantId: string, platId: string) {
  return q<LigneCandidat>(
    `select v.id, v.libelle, v.couleur::text as couleur, v.format, v.prix::float as prix, v.ordre, v.ranking_producteur, v.ranking_terroir,
            v.pays, v.cepages, nullif(regexp_replace(split_part(coalesce(v.vin_texte, ''), ' – ', 1), '\\(.*?\\)', '', 'g'), '') as appellation,
            a.note, a.origine::text as origine, a.statut::text as statut
       from accord a join vin_carte v on v.id = a.vin_id and v.disponible
      where a.restaurant_id = $1 and a.plat_id = $2 and a.note is not null
        and a.vin_id not in (select cible from regle_sommelier where restaurant_id = $1 and type = 'exclure' and portee = 'vin' and actif
                               and (date_debut is null or date_debut <= current_date) and (date_fin is null or date_fin >= current_date))`,
    [restaurantId, platId]);
}

const proposes = (lignes: { id: string; note: number }[], base: Omit<LigneCandidat, 'note'>[], platId: string, R: Reglages) => {
  const parId = new Map(base.map((b) => [b.id, b]));
  const candidats: Candidat[] = lignes.filter((l) => parId.has(l.id)).map((l) => ({ ...parId.get(l.id)!, notes: { [platId]: l.note } }));
  return selectionner(candidats, [platId], { reglages: R }).liste.map((r) => r.vin.id);
};

function comparer(avant: { id: string; note: number }[], apres: { id: string; note: number }[], base: Omit<LigneCandidat, 'note'>[],
  platId: string, Ravant: Reglages, Rapres: Reglages): Changements {
  const a = proposes(avant, base, platId, Ravant);
  const b = proposes(apres, base, platId, Rapres);
  const notesAvant = new Map(avant.map((x) => [x.id, x.note]));
  return {
    entrent: b.filter((x) => !a.includes(x)),
    sortent: a.filter((x) => !b.includes(x)),
    notes: apres.filter((x) => notesAvant.has(x.id) && notesAvant.get(x.id) !== x.note && (a.includes(x.id) || b.includes(x.id)))
      .map((x) => ({ vin: x.id, avant: notesAvant.get(x.id)!, apres: x.note })),
  };
}

async function reglagesRestaurant(q: Requete, restaurantId: string, base: Reglages) {
  const [r] = await q<{ reglages_selection: unknown }>('select reglages_selection from restaurant where id = $1', [restaurantId]);
  return reglagesComplets(r?.reglages_selection, base);
}

/** Changements visibles sur un plat. Principes : nouvelles notes de la publication ; règles : mêmes notes, nouvelles règles. */
async function changementsPlat(q: Requete, publicationId: string, type: TypePublication, restaurantId: string, platId: string,
  baseAvant: Reglages, baseApres: Reglages): Promise<Changements> {
  const lignes = await candidatsPlat(q, restaurantId, platId);
  const visibles = lignes.filter((l) => l.statut === 'valide');
  const avant = visibles.map((l) => ({ id: l.id, note: l.note }));
  let apres = avant;
  if (type === 'principes') {
    const nouvelles = new Map((await q<{ vin_id: string; note: number }>(
      'select vin_id, note from publication_accord where publication_id = $1 and plat_id = $2', [publicationId, platId])).map((x) => [x.vin_id, x.note]));
    // Note changée à la main : gardée ; accord refusé : reste hors liste ; sinon la nouvelle note (ou l'ancienne si Pat n'en a pas donné).
    apres = lignes.filter((l) => l.statut !== 'refuse')
      .map((l) => ({ id: l.id, note: l.origine === 'sommelier' ? l.note : nouvelles.get(l.id) ?? l.note }))
      .filter((l) => visibles.some((v) => v.id === l.id) || nouvelles.has(l.id));
  }
  const [Ravant, Rapres] = await Promise.all([reglagesRestaurant(q, restaurantId, baseAvant), reglagesRestaurant(q, restaurantId, baseApres)]);
  return comparer(avant, apres, lignes, platId, Ravant, Rapres);
}

// ─── Préparer ───

export async function preparerPublication(q: Requete, type: TypePublication, par: string) {
  const version = type === 'principes' ? await brouillonPrincipes(q) : await brouillonRegles(q);
  if (!version) return { erreurs: [`Aucun brouillon de ${type === 'principes' ? 'principes' : 'règles'} à publier.`] };
  const erreurs = 'principes' in version ? validerPrincipes(version).erreurs : validerParametres(version.parametres);
  if (erreurs.length) return { erreurs };

  // Une seule préparation à la fois par type : la précédente est annulée.
  await q(`update publication set statut = 'annulee' where type = $1 and statut in ('en_preparation', 'preparee')`, [type]);
  const [pub] = await q<{ id: string }>(
    `insert into publication (type, code, version_maj_le, prepare_par) values ($1, $2, $3, $4) returning id`,
    [type, version.code, version.maj_le, par]);
  await q(
    `insert into publication_plat (publication_id, restaurant_id, plat_id)
     select $1, pl.restaurant_id, pl.id from plat pl
      where pl.actif and exists (select 1 from accord a where a.plat_id = pl.id)`, [pub.id]);

  if (type === 'regles') {
    // Pas d'appel au modèle : changements calculés tout de suite.
    const [avant, apres] = [await parametresEnService(q), (version as { parametres: Reglages }).parametres];
    for (const p of await q<{ restaurant_id: string; plat_id: string }>('select restaurant_id, plat_id from publication_plat where publication_id = $1', [pub.id])) {
      const c = await changementsPlat(q, pub.id, 'regles', p.restaurant_id, p.plat_id, avant, apres);
      await q(`update publication_plat set statut = 'fait', changements = $3, fin_le = now() where publication_id = $1 and plat_id = $2`, [pub.id, p.plat_id, JSON.stringify(c)]);
    }
    await q(`update publication set statut = 'preparee' where id = $1`, [pub.id]);
  }
  return { erreurs: [], publicationId: pub.id, code: version.code };
}

/** Relance les plats en échec d'une préparation (sans refaire les autres). */
export async function relancerEchecs(q: Requete, publicationId: string) {
  const r = await q<{ plat_id: string }>(
    `update publication_plat set statut = 'en_attente', message = null, debut_le = null, fin_le = null
      where publication_id = $1 and statut = 'erreur' returning plat_id`, [publicationId]);
  if (r.length) await q(`update publication set statut = 'en_preparation' where id = $1 and statut = 'preparee'`, [publicationId]);
  return r.length;
}

interface Tache { publication_id: string; restaurant_id: string; plat_id: string; code: string }

async function prendre(q: Requete) {
  await q(`update publication_plat set statut = 'erreur', message = 'interrompu (délai dépassé)', fin_le = now()
            where statut = 'en_cours' and debut_le < now() - interval '${BLOQUE_APRES}'`);
  const [t] = await q<Tache>(
    `update publication_plat pp set statut = 'en_cours', debut_le = now()
       from publication p
      where p.id = pp.publication_id and (pp.publication_id, pp.plat_id) = (
              select x.publication_id, x.plat_id from publication_plat x join publication y on y.id = x.publication_id
               where x.statut = 'en_attente' and y.statut = 'en_preparation' order by y.prepare_le, x.plat_id
               for update of x skip locked limit 1)
      returning pp.publication_id, pp.restaurant_id, pp.plat_id, p.code`);
  return t ?? null;
}

/** Préparation terminée quand plus aucun plat n'attend ni n'est en cours (les échecs se relancent à part). */
async function cloturer(q: Requete, publicationId: string) {
  await q(`update publication set statut = 'preparee' where id = $1 and statut = 'en_preparation'
             and not exists (select 1 from publication_plat where publication_id = $1 and statut in ('en_attente', 'en_cours'))`, [publicationId]);
}

/**
 * Traite les plats en attente des préparations de principes jusqu'à épuisement ou jusqu'à l'heure limite.
 * Renvoie le nombre de plats encore en attente (à reprendre par un autre passage).
 */
export async function travaillerPublications(q: Requete, { finAvant, modele = modeleAccords(), client = clientClaude({ maxRetries: 6 }) }:
  { finAvant: number; modele?: string; client?: Anthropic }) {
  const principesParCode = new Map<string, Awaited<ReturnType<typeof principesPourGeneration>>>();
  const baseRegles = await parametresEnService(q);
  for (let t: Tache | null = await prendre(q); t; t = Date.now() < finAvant ? await prendre(q) : null) {
    try {
      if (!principesParCode.has(t.code)) {
        const [v] = await q<{ principes: never[] }>('select principes from principes_version where code = $1', [t.code]);
        if (!v) throw new Error(`version ${t.code} introuvable`);
        principesParCode.set(t.code, await principesPourGeneration(q, v));
      }
      const b = await regenererAccordsPlat(q, client, t.restaurant_id, t.plat_id, modele, { principes: principesParCode.get(t.code), publicationId: t.publication_id });
      const c = await changementsPlat(q, t.publication_id, 'principes', t.restaurant_id, t.plat_id, baseRegles, baseRegles);
      await q(`update publication_plat set statut = 'fait', changements = $3, fin_le = now(),
                 message = $4 where publication_id = $1 and plat_id = $2`,
        [t.publication_id, t.plat_id, JSON.stringify(c), b.aRevoir.length ? `inchangés (réponse à revoir) : ${b.aRevoir.join(', ')}` : null]);
    } catch (e) {
      await q(`update publication_plat set statut = 'erreur', message = $3, fin_le = now() where publication_id = $1 and plat_id = $2`,
        [t.publication_id, t.plat_id, String((e as Error).message ?? e).slice(0, 500)]);
      console.error(`[publication] ${t.plat_id} : échec`, e);
    }
    await cloturer(q, t.publication_id);
  }
  const [r] = await q<{ n: number }>(`select count(*)::int as n from publication_plat pp join publication p on p.id = pp.publication_id
                                        where pp.statut = 'en_attente' and p.statut = 'en_preparation'`);
  return r.n;
}

// ─── Suivi ───

export interface EtatPublication {
  id: string; type: TypePublication; code: string; statut: string; prepare_le: string; prepare_par: string | null;
  total: number; attente: number; enCours: number; faits: number; erreurs: number; platsModifies: number;
  versionModifiee: boolean;
}

export async function etatPublication(q: Requete, id: string): Promise<EtatPublication | null> {
  const [p] = await q<EtatPublication & { version_maj_le: string }>(
    `select p.id, p.type, p.code, p.statut, p.prepare_le, p.prepare_par, p.version_maj_le,
            count(pp.*)::int as total,
            count(*) filter (where pp.statut = 'en_attente')::int as attente,
            count(*) filter (where pp.statut = 'en_cours')::int as "enCours",
            count(*) filter (where pp.statut = 'fait')::int as faits,
            count(*) filter (where pp.statut = 'erreur')::int as erreurs,
            count(*) filter (where jsonb_array_length(coalesce(pp.changements->'entrent', '[]')) + jsonb_array_length(coalesce(pp.changements->'sortent', '[]'))
                                  + jsonb_array_length(coalesce(pp.changements->'notes', '[]')) > 0)::int as "platsModifies"
       from publication p left join publication_plat pp on pp.publication_id = p.id
      where p.id = $1 group by p.id`, [id]);
  if (!p) return null;
  const table = p.type === 'principes' ? 'principes_version' : 'regles_version';
  const [v] = await q<{ maj_le: string; statut: string }>(`select maj_le, statut from ${table} where code = $1`, [p.code]);
  return { ...p, versionModifiee: !v || v.statut !== 'brouillon' || new Date(v.maj_le) > new Date(p.version_maj_le) };
}

/** Changements par restaurant et par plat (pour l'écran de publication). */
export async function changementsPublication(q: Requete, id: string) {
  return q<{ restaurant_id: string; plat_id: string; plat: string; statut: string; message: string | null; changements: Changements | null }>(
    `select pp.restaurant_id, pp.plat_id, coalesce(pl.nom_court, pl.nom) as plat, pp.statut, pp.message, pp.changements
       from publication_plat pp join plat pl on pl.id = pp.plat_id
      where pp.publication_id = $1 order by pp.restaurant_id, pl.ordre`, [id]);
}

// ─── Confirmer, annuler ───

export async function confirmerPublication(q: Requete, id: string, par: string): Promise<{ erreurs: string[]; code?: string }> {
  const e = await etatPublication(q, id);
  if (!e || e.statut !== 'preparee') return { erreurs: ['Publication introuvable, pas encore prête ou déjà traitée.'] };
  if (e.versionModifiee) return { erreurs: ['Le brouillon a été modifié depuis la préparation : relancez la préparation.'] };
  if (e.erreurs) return { erreurs: [`${e.erreurs} plat(s) en échec : relancez-les avant de mettre en service.`] };

  if (e.type === 'principes') {
    // Nouveaux accords : une seule requête (atomique). Note changée à la main et commentaire réécrit par le restaurant gardés.
    await q(
      `insert into accord (restaurant_id, plat_id, vin_id, note, explication, limite, origine, statut, explication_generee_le, regenere_le, calcule_le, valide_le)
       select restaurant_id, plat_id, vin_id, note, explication, limite, 'pat', 'valide', now(), now(), now(), now()
         from publication_accord where publication_id = $1
       on conflict (plat_id, vin_id) do update set
         note = case when accord.origine = 'sommelier' then accord.note else excluded.note end,
         explication = coalesce(accord.commentaire_sommelier, excluded.explication), limite = excluded.limite,
         statut = case when accord.statut = 'refuse' then accord.statut else 'valide' end,
         valide_le = case when accord.statut = 'refuse' then accord.valide_le else coalesce(accord.valide_le, now()) end,
         explication_generee_le = now(), regenere_le = now(), calcule_le = now()`, [id]);
    // Rangs : par note, puis ordre de la carte, plat par plat.
    await q(
      `update accord a set rang = r.rn
         from (select a2.id, row_number() over (partition by a2.plat_id order by a2.note desc nulls last, v.ordre) as rn
                 from accord a2 join vin_carte v on v.id = a2.vin_id
                where a2.plat_id in (select plat_id from publication_plat where publication_id = $1)) r
        where a.id = r.id and a.rang is distinct from r.rn`, [id]);
    const [v] = await q<{ principes: never[] }>('select principes from principes_version where code = $1', [e.code]);
    await q(`update principes_version set statut = 'remplacee' where statut = 'en_service'`);
    await q(`update principes_version set statut = 'en_service', publie_le = now(), publie_par = $2 where code = $1`, [e.code, par]);
    await synchroniserPrincipes(q, e.code, v.principes);
  } else {
    await q(`update regles_version set statut = 'remplacee' where statut = 'en_service'`);
    await q(`update regles_version set statut = 'en_service', publie_le = now(), publie_par = $2 where code = $1`, [e.code, par]);
  }
  await q(`update publication set statut = 'confirmee', confirme_par = $2, confirme_le = now() where id = $1`, [id, par]);
  await q(`delete from publication_accord where publication_id = $1`, [id]);
  return { erreurs: [], code: e.code };
}

export async function annulerPublication(q: Requete, id: string) {
  await q(`update publication set statut = 'annulee' where id = $1 and statut in ('en_preparation', 'preparee')`, [id]);
  await q(`delete from publication_accord where publication_id = $1`, [id]);
}

/** Dernière publication du type (pour l'écran super-admin). */
export async function dernierePublication(q: Requete, type: TypePublication) {
  const [p] = await q<{ id: string }>(`select id from publication where type = $1 order by prepare_le desc limit 1`, [type]);
  return p ? etatPublication(q, p.id) : null;
}

