/**
 * Étiquettes partagées par la base de Pat, au niveau de la cuvée (tous millésimes).
 *
 * 1. Chaque vin d'une carte relié à un producteur est rattaché à une cuvée de ce producteur (même nom,
 *    aux mentions génériques près : « brut », « 1er cru »…). Une cuvée est créée, proposée à Pat,
 *    seulement quand le vin a une photo à lui donner.
 * 2. La photo d'un vin (déposée par le restaurant, trouvée par Wine Labs ou fournie à l'import) devient
 *    l'étiquette de sa cuvée si celle-ci n'en a pas (une nouvelle photo du restaurant la remplace).
 * 3. Les vins des autres cartes qui ont cette cuvée sans étiquette la reprennent (etiquette_source = 'cuvee').
 *    Une photo propre au vin n'est jamais écrasée.
 *
 * Sans 'server-only' : aussi appelé par scripts/migrer.ts (rattrapage au déploiement).
 */
import type { Requete } from '../generation/accords';

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'en', 'au', 'aux', 'a', 'the', 'di', 'del', 'della', 'y']);
// Mentions qui ne distinguent pas une cuvée d'une autre (la couleur, elle, distingue : « blanc », « rosé » restent).
const GENERIQUES = new Set(['brut', 'extra', 'nature', 'cru', 'er', '1er', 'premier', 'grand', 'igp', 'aop', 'aoc', 'doc', 'docg', 'do',
  'vdf', 'vin', 'cuvee', 'domaine', 'chateau', 'maison', 'superiore', 'classico']);
const ORDRE_SOURCE: Record<string, number> = { fichier: 1, wine_labs: 2, restaurant: 3 };

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe');
const mots = (t: string | null | undefined) => (t ? norm(t).split(/[^a-z0-9]+/).filter((m) => m && !MOTS_VIDES.has(m)) : []);
const slug = (t: string) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

type VinPartage = {
  id: string; libelle: string; vin_texte: string | null; couleur: string; producteur_id: string | null; producteur_nom: string | null;
  appellation_id: string | null; appellation_nom: string | null; cuvee_id: string | null; cuvee_producteur: string | null;
  etiquette_url: string | null; etiquette_source: string | null;
};
type CuveeBase = { id: string; nom: string; couleur: string | null; appellation?: string | null };

/** Couleurs incompatibles : un rosé n'est pas un blanc, un rouge n'est pas un blanc. Les bulles peuvent être blanches ou rosées. */
function couleursCompatibles(a: string | null, b: string | null) {
  return !a || !b || a === b || a === 'bulles' || b === 'bulles';
}

/** Cuvée du producteur qui correspond au vin de la carte, ou null. Exporté pour les tests. */
export function cuveeCorrespondante(vin: Pick<VinPartage, 'libelle' | 'vin_texte' | 'couleur' | 'producteur_nom'> & { appellation_nom?: string | null }, cuvees: CuveeBase[]) {
  const producteur = new Set(mots(vin.producteur_nom));
  const utiles = (t: string | null) => mots(t).filter((m) => !producteur.has(m) && !GENERIQUES.has(m));
  const duVin = new Set([...utiles(vin.libelle), ...utiles(vin.vin_texte)]);
  // Ce que la carte dit du vin, hors appellation : tout doit se retrouver dans la cuvée.
  const appellation = new Set(utiles(vin.appellation_nom ?? null));
  const propres = new Set(utiles(vin.libelle).filter((m) => !appellation.has(m)));
  let meilleure: CuveeBase | null = null, score = -1;
  for (const c of cuvees) {
    const m = new Set(utiles(c.nom));
    const avecAppellation = new Set([...m, ...utiles(c.appellation ?? null)]); // « Les Tessons » (Meursault) = « Meursault Les Tessons »
    if (!m.size || !couleursCompatibles(vin.couleur, c.couleur)) continue;
    if (![...m].every((x) => duVin.has(x)) || ![...propres].every((x) => avecAppellation.has(x))) continue;
    if (m.size > score) [meilleure, score] = [c, m.size];
  }
  return meilleure;
}

/**
 * Rattache les vins à leur cuvée et partage les étiquettes.
 * - `vins` : seulement ces vins (et les cartes qui partagent leurs cuvées) ; sinon toute la base.
 * - `nouvellePhoto` : vin dont le restaurant vient de déposer la photo — elle remplace celle de la cuvée.
 * Renvoie le nombre de vins d'autres cartes qui ont reçu une étiquette.
 */
export async function partagerEtiquettes(requete: Requete, { vins, nouvellePhoto }: { vins?: string[]; nouvellePhoto?: string } = {}) {
  const lignes = await requete<VinPartage>(
    `select v.id, v.libelle, v.vin_texte, v.couleur::text, v.producteur_id, p.nom as producteur_nom, v.appellation_id, t.nom as appellation_nom,
            v.cuvee_id, c.producteur_id as cuvee_producteur, v.etiquette_url, v.etiquette_source
       from vin_carte v left join producteur p on p.id = v.producteur_id left join cuvee c on c.id = v.cuvee_id
            left join terroir t on t.id = v.appellation_id
      where $1::text[] is null or v.id = any($1)`, [vins ?? null]);

  const cuveesDe = new Map<string, CuveeBase[]>();
  const cuveesDuProducteur = async (id: string) => {
    if (!cuveesDe.has(id)) cuveesDe.set(id, await requete<CuveeBase>(
      'select c.id, c.nom, c.couleur::text, t.nom as appellation from cuvee c left join terroir t on t.id = c.appellation_id where c.producteur_id = $1', [id]));
    return cuveesDe.get(id)!;
  };

  const touchees = new Set<string>();
  for (const v of lignes) {
    let cuvee = v.cuvee_id && v.cuvee_producteur === v.producteur_id ? v.cuvee_id : null;
    const aSaPhoto = Boolean(v.etiquette_url && v.etiquette_source && v.etiquette_source !== 'cuvee');
    if (!cuvee && v.producteur_id) {
      const liste = await cuveesDuProducteur(v.producteur_id);
      cuvee = cuveeCorrespondante(v, liste)?.id ?? null;
      if (!cuvee && aSaPhoto) {
        // Cuvée créée depuis la carte, proposée à Pat comme les cuvées converties automatiquement.
        cuvee = `carte-${v.producteur_id}-${slug(v.libelle)}`.slice(0, 120);
        await requete(
          `insert into cuvee (id, producteur_id, nom, appellation_id, couleur, statut, source)
           values ($1, $2, $3, $4, $5::couleur_vin, 'propose', 'carte') on conflict (id) do nothing`,
          [cuvee, v.producteur_id, v.libelle, v.appellation_id, v.couleur]);
        liste.push({ id: cuvee, nom: v.libelle, couleur: v.couleur });
      }
    }
    if (cuvee !== v.cuvee_id) await requete('update vin_carte set cuvee_id = $2 where id = $1', [v.id, cuvee]);
    if (v.cuvee_id) touchees.add(v.cuvee_id); // ancienne cuvée : ses vins hérités sont revus plus bas
    if (!cuvee) continue;
    touchees.add(cuvee);

    // Photo du vin → étiquette de la cuvée (si elle n'en a pas, ou d'une source moins sûre ; la nouvelle photo du restaurant gagne).
    if (aSaPhoto) {
      await requete(
        `update cuvee set etiquette_url = $2, etiquette_source = $3, etiquette_vin_id = $4, etiquette_maj_le = now()
          where id = $1 and etiquette_url is distinct from $2
            and ($5 or etiquette_url is null
                 or coalesce(array_position(array['fichier', 'wine_labs', 'restaurant'], etiquette_source), 0) < $6)`,
        [cuvee, v.etiquette_url, v.etiquette_source, v.id, v.id === nouvellePhoto, ORDRE_SOURCE[v.etiquette_source!] ?? 0]);
    }
  }
  if (!touchees.size) return 0;

  // Étiquette de la cuvée → vins sans photo propre (toutes les cartes).
  const recues = await requete<{ id: string }>(
    `update vin_carte v set etiquette_url = c.etiquette_url, etiquette_source = 'cuvee', etiquette_statut = 'trouvee'
       from cuvee c
      where v.cuvee_id = c.id and c.id = any($1) and c.etiquette_url is not null
        and (v.etiquette_url is null or v.etiquette_source = 'cuvee') and v.etiquette_url is distinct from c.etiquette_url
      returning v.id`, [[...touchees]]);
  // Vin qui avait hérité d'une étiquette et n'est plus rattaché à cette cuvée (producteur changé) : il la perd.
  await requete(
    `update vin_carte v set etiquette_url = null, etiquette_source = null, etiquette_statut = null
      where v.etiquette_source = 'cuvee' and ($1::text[] is null or v.id = any($1) or v.cuvee_id = any($2))
        and not exists (select 1 from cuvee c where c.id = v.cuvee_id and c.etiquette_url = v.etiquette_url)`,
    [vins ?? null, [...touchees]]);
  return recues.length;
}
