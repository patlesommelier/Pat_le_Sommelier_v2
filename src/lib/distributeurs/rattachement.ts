// Vins d'un tarif reliés à la base de Pat :
// - producteur : celui de la base (trouvé à la lecture), sinon des producteurs proches proposés à Pat, sinon ajouté à la base « à valider » ;
// - vin : la cuvée du producteur qui porte le même nom, sinon ajoutée à la base « à valider ».
// Sans « server-only » : appelé aussi à la lecture du tarif, en arrière-plan.
import type { Requete } from '../generation/accords';
import { motsDe } from './tarif';
import { partagerEtiquettesDistributeur } from './etiquettes';

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

/** Cuvées retrouvées pour les vins rattachés à un producteur dont la cuvée n'a pas été choisie à la main. Renvoie le nombre de vins reliés. */
export async function rattacherCuvees(requete: Requete, distributeurId: string) {
  const vins = await requete<{ id: string; libelle: string; producteur_texte: string | null; producteur_id: string; producteur_nom: string; cuvee_id: string | null }>(
    `select v.id, v.libelle, v.producteur_texte, v.producteur_id, p.nom as producteur_nom, v.cuvee_id
       from distributeur_vin v join producteur p on p.id = v.producteur_id where v.distributeur_id = $1 and not v.cuvee_manuel`, [distributeurId]);
  if (!vins.length) return 0;
  const cuvees = await requete<CuveeBase>(
    `select c.id, c.producteur_id, c.nom, coalesce(t.nom, c.appellation_texte) as appellation from cuvee c left join terroir t on t.id = c.appellation_id
      where c.producteur_id = any($1) and c.statut <> 'retire'`, [[...new Set(vins.map((v) => v.producteur_id))]]);
  const liens = vins.map((v) => ({ id: v.id, avant: v.cuvee_id,
    cuvee: cuveeDuVin(v, cuvees.filter((c) => c.producteur_id === v.producteur_id), v.producteur_nom)?.id ?? null }));
  const changes = liens.filter((l) => l.cuvee !== l.avant);
  if (changes.length) {
    await requete(`update distributeur_vin v set cuvee_id = x.cuvee from unnest($1::text[], $2::text[]) as x(id, cuvee) where v.id = x.id`,
      [changes.map((l) => l.id), changes.map((l) => l.cuvee)]);
  }
  await partagerEtiquettesDistributeur(requete, distributeurId);
  return liens.filter((l) => l.cuvee).length;
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

/** Vins des producteurs rattachés, sans cuvée dans la base : ajoutés comme cuvées « proposées » (à valider dans Vins de la base). */
export async function ajouterCuveesManquantes(requete: Requete, distributeurId: string) {
  const vins = await requete<{ id: string; producteur_id: string; libelle: string; couleur: string | null }>(
    `select id, producteur_id, libelle, couleur from distributeur_vin
      where distributeur_id = $1 and actif and producteur_id is not null and cuvee_id is null`, [distributeurId]);
  const COULEURS = ['bulles', 'blanc', 'rose', 'rouge', 'orange', 'doux'];
  for (const v of vins) {
    const id = `distributeur-${v.producteur_id}-${slug(v.libelle)}`.slice(0, 120);
    await requete(`insert into cuvee (id, producteur_id, nom, couleur, statut, source) values ($1, $2, $3, $4::couleur_vin, 'propose', 'distributeur') on conflict (id) do nothing`,
      [id, v.producteur_id, v.libelle, v.couleur && COULEURS.includes(v.couleur) ? v.couleur : null]);
    await requete('update distributeur_vin set cuvee_id = $2 where id = $1', [v.id, id]);
  }
  await partagerEtiquettesDistributeur(requete, distributeurId);
  return vins.length;
}
