// Vins d'un tarif reliés à la base de Pat :
// - producteur : celui de la base (trouvé à la lecture), sinon des producteurs proches proposés à Pat, sinon ajouté à la base « à valider » ;
// - vin : la cuvée du producteur qui porte le même nom, sinon ajoutée à la base « à valider ».
// Sans « server-only » : appelé aussi à la lecture du tarif, en arrière-plan.
import type { Requete } from '../generation/accords';
import { motsDe } from './tarif';
import { partagerEtiquettesDistributeur } from './etiquettes';
import { creerAppellationProposeeAvec } from '../appellations/creation';

export interface ProducteurBase { id: string; nom: string; region: string | null; ranking_pat: number | null; statut: string }
export interface Suggestion extends ProducteurBase { score: number }

// Fréquence de chaque mot dans les noms de la base : un mot fréquent (prénom, « saint », « vignes ») pèse peu,
// un mot rare (« Davenne », « Martenot ») pèse beaucoup. Calculée une fois par liste.
const frequences = new WeakMap<ProducteurBase[], Map<string, number>>();
function frequence(base: ProducteurBase[]) {
  let f = frequences.get(base);
  if (!f) {
    f = new Map();
    for (const p of base) for (const m of motsDe(p.nom)) f.set(m, (f.get(m) ?? 0) + 1);
    frequences.set(base, f);
  }
  return f;
}

/**
 * Producteurs de la base proches du nom lu sur le tarif, les plus proches d'abord (trois au plus). Chaque mot pèse
 * d'autant plus qu'il est rare dans la base ; il faut qu'au moins la moitié du poids du nom du tarif se retrouve
 * dans le nom de la base, et inversement un bon tiers (« Yves » seul ne fait pas « Domaine Yves Duport »).
 */
export function suggererProducteurs(nom: string, base: ProducteurBase[], max = 3): Suggestion[] {
  const a = motsDe(nom);
  if (!a.length) return [];
  const f = frequence(base);
  const poids = (m: string) => (m.length < 3 ? 0.1 : 1 / Math.max(1, f.get(m) ?? 1));
  const total = (mots: string[]) => mots.reduce((n, m) => n + poids(m), 0);
  const ta = total(a);
  return base.map((p) => {
    const b = motsDe(p.nom);
    const communs = total(a.filter((m) => b.includes(m)));
    const score = Math.min(communs / ta, communs / Math.max(total(b), 0.01) + 0.2);
    return { ...p, score: Math.round((score + (p.statut === 'valide' ? 0.01 : 0)) * 100) / 100 };
  }).filter((p) => p.score >= 0.45).sort((x, y) => y.score - x.score || x.nom.length - y.nom.length).slice(0, max);
}

export interface CuveeBase { id: string; producteur_id: string; nom: string; appellation: string | null }

/**
 * Cuvée du producteur qui correspond au vin du tarif : mêmes mots, une fois retirés ceux du producteur
 * (le nom de la cuvée seul, ou avec son appellation). En cas de doute, aucune.
 */
export function cuveeDuVin(v: { libelle: string; producteur_texte: string | null }, cuvees: CuveeBase[], producteurNom: string | null): CuveeBase | null {
  const retirer = new Set([...motsDe(v.producteur_texte), ...motsDe(producteurNom)]);
  const cle = (t: string) => motsDe(t).filter((m) => !retirer.has(m)).sort().join(' ');
  const vin = cle(v.libelle);
  if (!vin) return null;
  const trouvees = cuvees.filter((c) => cle(c.nom) === vin || (c.appellation && cle(`${c.appellation} ${c.nom}`) === vin));
  return trouvees.length === 1 ? trouvees[0] : null;
}

/**
 * Comme cuveeDuVin, et sinon une écriture différente du même vin : tous les mots propres à la cuvée (hors producteur et
 * appellation) sont dans le nom lu, et le nom lu ne dit rien que la cuvée, son appellation ou l'appellation donnée à part
 * (colonne du tarif) ne disent (« IGP Haute Vallée de l'Aude Vue du Ciel » → « Vue du Ciel » ; « Crémant Zéro Dosage »
 * → « Crémant d'Alsace Zéro Dosage »). Un mot de plus (« rosé » pour un vin « blanc ») suffit à écarter. Une seule cuvée possible.
 */
export function cuveeDuVinSouple<C extends CuveeBase>(v: { libelle: string; producteur_texte: string | null; appellation?: string | null },
  cuvees: C[], producteurNom: string | null): C | null {
  const exacte = cuveeDuVin(v, cuvees, producteurNom) as C | null;
  if (exacte) return exacte;
  const retirer = new Set([...motsDe(v.producteur_texte), ...motsDe(producteurNom)]);
  const mots = (t: string | null | undefined) => motsDe(t).filter((m) => !retirer.has(m));
  const vin = mots(v.libelle);
  if (!vin.length) return null;
  const appellationLue = mots(v.appellation);
  const trouvees = cuvees.filter((c) => {
    const appellation = mots(c.appellation);
    const propres = mots(c.nom).filter((m) => !appellation.includes(m) && !appellationLue.includes(m));
    const permis = new Set([...mots(c.nom), ...appellation, ...appellationLue]);
    if (!vin.every((m) => permis.has(m))) return false;
    return propres.length ? propres.every((m) => vin.includes(m)) : appellation.length > 0 && appellation.every((m) => vin.includes(m));
  });
  if (trouvees.length === 1) return trouvees[0];
  if (trouvees.length > 1) return null;
  // Dernier recours : le nom lu finit par le nom complet de la cuvée (deux mots au moins), précédé de son appellation
  // que la base ne connaît pas (« IGP Haute Vallée de l'Aude Vue du Ciel » → « Vue du Ciel »).
  const suite = (t: string) => motsDe(t).filter((m) => !retirer.has(m));
  const lu = suite(v.libelle);
  const finissent = cuvees.filter((c) => {
    const n = suite(c.nom);
    return n.length >= 2 && n.length < lu.length && lu.slice(-n.length).join(' ') === n.join(' ');
  });
  return finissent.length === 1 ? finissent[0] : null;
}

/** Cuvées retrouvées pour les vins rattachés à un producteur dont la cuvée n'a pas été choisie à la main. Renvoie le nombre de vins reliés. */
export async function rattacherCuvees(requete: Requete, distributeurId: string) {
  const vins = await requete<{ id: string; libelle: string; producteur_texte: string | null; producteur_id: string; producteur_nom: string; cuvee_id: string | null; appellation: string | null }>(
    `select v.id, v.libelle, v.producteur_texte, v.producteur_id, p.nom as producteur_nom, v.cuvee_id, v.appellation
       from distributeur_vin v join producteur p on p.id = v.producteur_id where v.distributeur_id = $1 and not v.cuvee_manuel`, [distributeurId]);
  if (!vins.length) return 0;
  const cuvees = await requete<CuveeBase & { proposee: boolean }>(
    `select c.id, c.producteur_id, c.nom, coalesce(t.nom, c.appellation_texte) as appellation,
            (c.statut = 'propose' and coalesce(c.source, '') = 'distributeur') as proposee
       from cuvee c left join terroir t on t.id = c.appellation_id
      where c.producteur_id = any($1) and c.statut <> 'retire'`, [[...new Set(vins.map((v) => v.producteur_id))]]);
  // Appellation écrite dans le nom du vin quand le tarif ne la donne pas à part (« IGP Haute Vallée de l'Aude Vue du Ciel ») :
  // la plus longue appellation de la base dont tous les mots y figurent.
  const terroirs = (await requete<{ nom: string }>(`select nom from terroir where statut <> 'retire'`)).map((t) => ({ nom: t.nom, mots: motsDe(t.nom) }))
    .filter((t) => t.mots.length >= 2);
  const appellationDans = (libelle: string) => {
    const mots = new Set(motsDe(libelle));
    return terroirs.filter((t) => t.mots.every((m) => mots.has(m))).sort((a, b) => b.mots.length - a.mots.length)[0]?.nom ?? null;
  };
  // Les vins de la base d'abord ; un vin seulement proposé depuis un tarif (souvent un doublon) en dernier recours.
  const choisir = (w: (typeof vins)[number]) => {
    const v = { ...w, appellation: w.appellation ?? appellationDans(w.libelle) };
    const siennes = cuvees.filter((c) => c.producteur_id === v.producteur_id);
    return cuveeDuVinSouple(v, siennes.filter((c) => !c.proposee), v.producteur_nom) ?? cuveeDuVinSouple(v, siennes, v.producteur_nom);
  };
  const liens = vins.map((v) => ({ id: v.id, avant: v.cuvee_id,
    cuvee: choisir(v)?.id ?? null }));
  const changes = liens.filter((l) => l.cuvee !== l.avant);
  if (changes.length) {
    await requete(`update distributeur_vin v set cuvee_id = x.cuvee from unnest($1::text[], $2::text[]) as x(id, cuvee) where v.id = x.id`,
      [changes.map((l) => l.id), changes.map((l) => l.cuvee)]);
  }
  await partagerEtiquettesDistributeur(requete, distributeurId);
  return liens.filter((l) => l.cuvee).length;
}

/**
 * Vins du tarif comparés aux vins des cartes des restaurants (même producteur, même vin, mêmes règles que cuveeDuVinSouple) :
 * - sans photo, ils prennent celle de la carte (ex. la liste de LVQNEP, export de la carte de Bistro Bercuit) ;
 * - sans vin de la base (ou relié seulement à une proposition venue d'un tarif), ils prennent celui de la carte s'il en a un.
 * Un choix fait à la main n'est jamais changé. Renvoie le nombre de vins complétés.
 */
export async function completerDepuisLesCartes(requete: Requete, distributeurId: string) {
  const vins = await requete<{ id: string; libelle: string; producteur_texte: string | null; producteur_id: string; producteur_nom: string; appellation: string | null;
    cuvee_id: string | null; cuvee_manuel: boolean; proposee: boolean; photo: boolean }>(
    `select v.id, v.libelle, v.producteur_texte, v.producteur_id, p.nom as producteur_nom, v.appellation, v.cuvee_id, v.cuvee_manuel,
            coalesce(c.statut = 'propose' and c.source = 'distributeur', false) as proposee,
            (v.etiquette_url is not null or c.etiquette_url is not null) as photo
       from distributeur_vin v join producteur p on p.id = v.producteur_id left join cuvee c on c.id = v.cuvee_id
      where v.distributeur_id = $1 and v.actif`, [distributeurId]);
  const aCompleter = vins.filter((v) => !v.photo || (!v.cuvee_manuel && (!v.cuvee_id || v.proposee)));
  if (!aCompleter.length) return 0;
  const cartes = await requete<{ id: string; producteur_id: string; nom: string; appellation: string | null; cuvee_id: string | null; etiquette_url: string | null }>(
    `select v.id, v.producteur_id, coalesce(nullif(v.nom_vin, ''), v.libelle) as nom, coalesce(t.nom, v.appellation_texte) as appellation, v.cuvee_id, v.etiquette_url
       from vin_carte v left join terroir t on t.id = v.appellation_id
      where v.producteur_id = any($1) and (v.etiquette_url is not null or v.cuvee_id is not null)
      order by (v.etiquette_url is not null) desc, (v.cuvee_id is not null) desc`, [[...new Set(aCompleter.map((v) => v.producteur_id))]]);
  // Un même vin sur plusieurs cartes (ou en plusieurs contenances) ne compte qu'une fois.
  const uniques = [...new Map(cartes.map((c) => [`${c.producteur_id}|${c.cuvee_id ?? motsDe(c.nom).sort().join(' ')}`, c])).values()];
  let completes = 0;
  for (const v of aCompleter) {
    const trouve = cuveeDuVinSouple(v, uniques.filter((c) => c.producteur_id === v.producteur_id), v.producteur_nom);
    if (!trouve) continue;
    const memes = cartes.filter((c) => c.producteur_id === v.producteur_id && (trouve.cuvee_id ? c.cuvee_id === trouve.cuvee_id : c.id === trouve.id));
    const photo = memes.find((c) => c.etiquette_url)?.etiquette_url ?? null;
    const cuvee = memes.find((c) => c.cuvee_id)?.cuvee_id ?? null;
    const nouvelleCuvee = !v.cuvee_manuel && (!v.cuvee_id || v.proposee) && cuvee && cuvee !== v.cuvee_id ? cuvee : null;
    if (!nouvelleCuvee && (v.photo || !photo)) continue;
    await requete(
      `update distributeur_vin set cuvee_id = coalesce($2, cuvee_id),
              etiquette_url = coalesce(etiquette_url, $3), image_source = case when etiquette_url is null and $3::text is not null then 'carte' else image_source end
        where id = $1`, [v.id, nouvelleCuvee, v.photo ? null : photo]);
    completes++;
  }
  await partagerEtiquettesDistributeur(requete, distributeurId);
  return completes;
}

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/**
 * Producteur du tarif ajouté à la base de Pat, au statut « proposé » (à valider dans Producteurs), puis relié à tous les vins
 * du distributeur qui portent ce nom. Renvoie son identifiant.
 */
export async function ajouterProducteurBase(requete: Requete, distributeurId: string, nomTarif: string) {
  const [d] = await requete<{ nom: string }>('select nom from distributeur where id = $1', [distributeurId]);
  const [exemple] = await requete<{ section: string | null; libelle: string }>(
    'select section, libelle from distributeur_vin where distributeur_id = $1 and producteur_texte = $2 order by ordre limit 1', [distributeurId, nomTarif]);
  const id = `distributeur-prod-${slug(nomTarif)}`;
  await requete(
    `insert into producteur (id, nom, region, statut, source, a_verifier) values ($1, $2, $3, 'propose', 'distributeur', $4) on conflict (id) do nothing`,
    [id, nomTarif, exemple?.section ?? null, `Repéré dans le tarif de ${d?.nom ?? 'un distributeur'}${exemple ? ` : ${exemple.libelle}` : ''}`]);
  await relierProducteur(requete, distributeurId, nomTarif, id);
  return id;
}

/** Tous les vins du distributeur qui portent ce nom de producteur sont reliés à ce producteur de la base (choix gardé). */
export async function relierProducteur(requete: Requete, distributeurId: string, nomTarif: string, producteurId: string | null) {
  await requete(
    `update distributeur_vin set producteur_id = $3, producteur_manuel = true, cuvee_id = case when producteur_id is distinct from $3 then null else cuvee_id end,
            cuvee_manuel = case when producteur_id is distinct from $3 then false else cuvee_manuel end
      where distributeur_id = $1 and coalesce(producteur_texte, '') = $2`, [distributeurId, nomTarif, producteurId]);
  // Ses vins : reliés à ceux de la base, ou ajoutés à la base (à valider).
  await rattacherCuvees(requete, distributeurId);
  if (producteurId) await ajouterCuveesManquantes(requete, distributeurId);
}

/** Nom du vin sans l'appellation placée devant (« Médoc Chateau X » → « Chateau X ») ; inchangé si le reste serait vide. */
export function nomSansAppellation(libelle: string, appellation: string | null) {
  if (!appellation) return libelle;
  const n = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const mots = libelle.trim().split(/\s+/), cible = n(appellation);
  for (let i = 1; i < mots.length; i++) if (n(mots.slice(0, i).join(' ')) === cible) return mots.slice(i).join(' ');
  return libelle;
}

/** Vins des producteurs rattachés, sans cuvée dans la base : ajoutés comme cuvées « proposées » (à valider dans Vins de la base). */
export async function ajouterCuveesManquantes(requete: Requete, distributeurId: string) {
  const vins = await requete<{ id: string; producteur_id: string; libelle: string; couleur: string | null; appellation: string | null }>(
    `select id, producteur_id, libelle, couleur, appellation from distributeur_vin
      where distributeur_id = $1 and actif and producteur_id is not null and cuvee_id is null`, [distributeurId]);
  const COULEURS = ['bulles', 'blanc', 'rose', 'rouge', 'orange', 'doux'];
  for (const v of vins) {
    // Appellation donnée à part par le tarif : retirée du début du nom (« Médoc Chateau LA TOUR DE BY » → « Chateau LA TOUR DE BY »).
    const nom = nomSansAppellation(v.libelle, v.appellation);
    const id = `distributeur-${v.producteur_id}-${slug(nom)}`.slice(0, 120);
    await requete(`insert into cuvee (id, producteur_id, nom, couleur, statut, source) values ($1, $2, $3, $4::couleur_vin, 'propose', 'distributeur') on conflict (id) do nothing`,
      [id, v.producteur_id, nom, v.couleur && COULEURS.includes(v.couleur) ? v.couleur : null]);
    await requete('update distributeur_vin set cuvee_id = $2 where id = $1', [v.id, id]);
  }
  await partagerEtiquettesDistributeur(requete, distributeurId);
  await appliquerAppellations(requete, distributeurId);
  return vins.length;
}

/**
 * Appellation donnée par le tarif (colonne « Appellation ») → vin de la base qui n'en a pas : reliée à l'appellation de la base
 * de même nom, sinon créée « à valider » (Super-admin → Appellations). Une appellation déjà renseignée n'est jamais remplacée.
 */
export async function appliquerAppellations(requete: Requete, distributeurId: string) {
  const vins = await requete<{ cuvee_id: string; appellation: string; region: string | null }>(
    `select distinct on (v.cuvee_id) v.cuvee_id, v.appellation, v.section as region
       from distributeur_vin v join cuvee c on c.id = v.cuvee_id
      where v.distributeur_id = $1 and v.actif and v.appellation is not null and c.appellation_id is null and nullif(c.appellation_texte, '') is null`, [distributeurId]);
  const ids = new Map<string, string>();
  for (const v of vins) {
    if (!ids.has(v.appellation)) ids.set(v.appellation, await creerAppellationProposeeAvec(requete, v.appellation, 'distributeur', null));
    await requete(`update cuvee set appellation_id = $2, appellation_texte = $3 where id = $1 and appellation_id is null and nullif(appellation_texte, '') is null`,
      [v.cuvee_id, ids.get(v.appellation), v.appellation]);
  }
  return vins.length;
}
