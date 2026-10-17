/**
 * Étiquettes partagées par la base de Pat, au niveau de la cuvée (tous millésimes).
 *
 * 1. Chaque vin d'une carte relié à un producteur est rattaché à une cuvée de ce producteur (même nom,
 *    aux mentions génériques près : « brut », « 1er cru »…). Une cuvée est créée, proposée à Pat,
 *    seulement quand le vin a une photo à lui donner. Si le producteur est en double dans la base (même nom, avec ou sans
 *    le propriétaire : « Château Mourgues du Grès - François Collard »), les cuvées de son homonyme sont cherchées aussi.
 * 2. La photo d'un vin (déposée par le restaurant, trouvée par Wine Labs ou fournie à l'import) devient
 *    l'étiquette de sa cuvée si celle-ci n'en a pas (une nouvelle photo du restaurant la remplace).
 * 3. Les vins des autres cartes qui ont cette cuvée sans étiquette la reprennent (etiquette_source = 'cuvee').
 *    Une photo propre au vin n'est jamais écrasée.
 *
 * Sans 'server-only' : aussi appelé par scripts/migrer.ts (rattrapage au déploiement).
 */
import type { Requete } from '../generation/accords';
import { producteurConnu } from '../inscription/lecture';

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'en', 'au', 'aux', 'a', 'the', 'di', 'del', 'della', 'y']);
// Mentions qui ne distinguent pas une cuvée d'une autre (la couleur, elle, distingue : « blanc », « rosé » restent).
const GENERIQUES = new Set(['brut', 'extra', 'nature', 'cru', 'er', '1er', 'premier', 'grand', 'igp', 'aop', 'aoc', 'doc', 'docg', 'do',
  'vdf', 'vin', 'cuvee', 'domaine', 'chateau', 'maison', 'superiore', 'classico', 'weingut', 'bodega', 'bodegas', 'tenuta', 'cantina', 'trocken',
  // Pays (souvent en tête de ligne sur les cartes : « Allemagne - Riesling Eisquell »).
  'france', 'allemagne', 'autriche', 'italie', 'espagne', 'portugal', 'suisse', 'grece', 'hongrie', 'slovenie', 'croatie', 'georgie', 'liban',
  'israel', 'chili', 'argentine', 'australie', 'usa', 'belgique', 'luxembourg', 'roumanie', 'bulgarie', 'moldavie', 'uruguay', 'bresil']);
const ORDRE_SOURCE: Record<string, number> = { fichier: 1, wine_labs: 2, restaurant: 3 };

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe');
const mots = (t: string | null | undefined) => (t ? norm(t).split(/[^a-z0-9]+/).filter((m) => m && !MOTS_VIDES.has(m)) : []);
const slug = (t: string) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

type VinPartage = {
  id: string; libelle: string; vin_texte: string | null; couleur: string; cepages?: string | null; producteur_id: string | null; producteur_nom: string | null;
  producteur_texte?: string | null; appellation_id: string | null; appellation_nom: string | null; cuvee_id: string | null; cuvee_producteur: string | null;
  cuvee_retiree?: boolean; etiquette_url: string | null; etiquette_source: string | null;
};
type CuveeBase = { id: string; nom: string; couleur: string | null; appellation?: string | null; cepages?: string | null; etiquette_url?: string | null };

/** Nom du producteur lu sur la carte, sauf « Non précisé », « inconnu »… */
const nomLu = (t: string | null | undefined) => (t && !/^non\b|inconnu|à préciser|a preciser/i.test(t.trim()) ? t : null);

/** Clé d'une étiquette gardée par nom (vin sans producteur) : nom normalisé et couleur. Exporté pour les tests. */
export const cleLibelle = (libelle: string, couleur: string) => `${slug(libelle)}|${couleur}`;

// Cépages courants : écrits sur la carte (« Viognier Secret de Famille ») mais pas toujours dans le nom de la cuvée
// (« Secret de Famille »), ou l'inverse. Ils ne suffisent pas à distinguer deux cuvées ; ils départagent seulement.
const CEPAGES = new Set(['viognier', 'chardonnay', 'sauvignon', 'pinot', 'gamay', 'syrah', 'shiraz', 'grenache', 'garnacha', 'merlot', 'cabernet',
  'malbec', 'mourvedre', 'carignan', 'cinsault', 'cinsaut', 'marsanne', 'roussanne', 'chenin', 'riesling', 'gewurztraminer', 'muscat', 'semillon',
  'aligote', 'nebbiolo', 'sangiovese', 'tempranillo', 'vermentino', 'rolle', 'picpoul', 'albarino', 'gruner', 'veltliner', 'zinfandel', 'primitivo',
  'tannat', 'verdot', 'savagnin', 'trousseau', 'poulsard', 'mondeuse', 'jacquere', 'altesse', 'clairette', 'bourboulenc', 'ugni', 'colombard',
  'melon', 'folle', 'negrette', 'fer', 'duras', 'mauzac', 'auxerrois', 'sylvaner', 'nerello', 'carricante', 'aglianico', 'barbera', 'dolcetto',
  'montepulciano', 'trebbiano', 'garganega', 'glera', 'corvina', 'verdejo', 'godello', 'mencia', 'touriga', 'furmint', 'assyrtiko', 'pinotage']);

/** Couleurs incompatibles : un rosé n'est pas un blanc, un rouge n'est pas un blanc. Les bulles peuvent être blanches ou rosées. */
function couleursCompatibles(a: string | null, b: string | null) {
  return !a || !b || a === b || a === 'bulles' || b === 'bulles';
}

/** Cuvée du producteur qui correspond au vin de la carte, ou null. Exporté pour les tests. */
export function cuveeCorrespondante(vin: Pick<VinPartage, 'libelle' | 'vin_texte' | 'couleur' | 'producteur_nom'> & { producteur_texte?: string | null; appellation_nom?: string | null; cepages?: string | null }, cuvees: CuveeBase[]) {
  // Mots du producteur : nom de la base et nom lu sur la carte (« Château Mourgues du Grès - François Collard » : le propriétaire aussi).
  const producteur = new Set([...mots(vin.producteur_nom), ...mots(nomLu(vin.producteur_texte))]);
  const utiles = (t: string | null) => mots(t).filter((m) => !producteur.has(m) && !GENERIQUES.has(m));
  const duVin = new Set([...utiles(vin.libelle), ...utiles(vin.vin_texte)]);
  // Ce que la carte dit du vin, hors appellation : tout doit se retrouver dans la cuvée.
  const appellation = new Set(utiles(vin.appellation_nom ?? null));
  const propres = new Set(utiles(vin.libelle).filter((m) => !appellation.has(m)));
  let meilleure: CuveeBase | null = null, score = -1;
  for (const c of cuvees) {
    if (!couleursCompatibles(vin.couleur, c.couleur)) continue;
    // Cépages du vin et de la cuvée : on peut les omettre d'un côté comme de l'autre.
    const cepages = new Set([...CEPAGES, ...mots(vin.cepages ?? null), ...mots(c.cepages ?? null)]);
    const nom = utiles(c.nom);
    const m = new Set(nom.some((x) => !cepages.has(x)) ? nom.filter((x) => !cepages.has(x)) : nom); // une cuvée nommée par son seul cépage le garde
    const appellationCuvee = new Set(utiles(c.appellation ?? null));
    const avecAppellation = new Set([...m, ...appellationCuvee]); // « Les Tessons » (Meursault) = « Meursault Les Tessons »
    if (!m.size) continue;
    // L'appellation écrite dans le nom de la cuvée (« Rheinhessen Riesling Eisquell ») peut manquer sur la carte.
    const requis = [...m].some((x) => !appellationCuvee.has(x)) ? [...m].filter((x) => !appellationCuvee.has(x)) : [...m];
    if (!requis.every((x) => duVin.has(x)) || ![...propres].every((x) => avecAppellation.has(x) || (cepages.has(x) && !nom.every((y) => cepages.has(y))))) continue;
    // La plus précise d'abord ; à égalité, celle dont les cépages nommés se retrouvent sur la carte, puis celle qui a une étiquette.
    const s = requis.length * 10 + nom.filter((x) => duVin.has(x)).length + (c.etiquette_url ? 0.5 : 0);
    if (s > score) [meilleure, score] = [c, s];
  }
  if (meilleure) return meilleure;
  // La carte ne nomme pas la cuvée, seulement l'appellation (« Costières de Nîmes ») : si le producteur n'a qu'un vin
  // de cette couleur dans cette appellation, c'est celui-là. Sans appellation, on ne devine pas.
  const restent = [...propres].filter((x) => !CEPAGES.has(x) && !mots(vin.cepages ?? null).includes(x));
  const zone = restent.length ? restent : [...appellation];
  if (!zone.length) return null;
  const memeCouleur = cuvees.filter((c) => c.couleur === vin.couleur);
  const seuls = memeCouleur.filter((c) => zone.every((x) => utiles(c.appellation ?? null).includes(x)));
  if (seuls.length) return seuls.length === 1 ? seuls[0] : null;
  // Aucune cuvée de la base n'a cette appellation, mais le producteur n'a qu'un vin de cette couleur, sans appellation renseignée,
  // et la carte ne dit rien d'autre que l'appellation (lue à l'import : vin_texte « Costières de Nîmes », ou celle de la base).
  const appellationLue = new Set([...appellation, ...utiles(vin.vin_texte?.split(' – ')[0] ?? null)]);
  const seul = memeCouleur.length === 1 && !utiles(memeCouleur[0].appellation ?? null).length;
  return seul && zone.every((x) => appellationLue.has(x)) ? memeCouleur[0] : null;
}

/**
 * Rattache les vins à leur cuvée et partage les étiquettes.
 * - `vins` : seulement ces vins (et les cartes qui partagent leurs cuvées) ; sinon toute la base.
 * - `nouvellePhoto` : vin dont le restaurant vient de déposer la photo — elle remplace celle de la cuvée.
 * Renvoie le nombre de vins d'autres cartes qui ont reçu une étiquette.
 */
export async function partagerEtiquettes(requete: Requete, { vins, nouvellePhoto }: { vins?: string[]; nouvellePhoto?: string } = {}) {
  const lignes = await requete<VinPartage>(
    `select v.id, v.libelle, v.vin_texte, v.couleur::text, v.cepages, v.producteur_id, p.nom as producteur_nom, v.producteur_texte,
            v.appellation_id, t.nom as appellation_nom, v.cuvee_id, c.producteur_id as cuvee_producteur, c.statut = 'retire' as cuvee_retiree,
            v.etiquette_url, v.etiquette_source
       from vin_carte v left join producteur p on p.id = v.producteur_id left join cuvee c on c.id = v.cuvee_id
            left join terroir t on t.id = v.appellation_id
      where $1::text[] is null or v.id = any($1)`, [vins ?? null]);

  const cuveesDe = new Map<string, CuveeBase[]>();
  const cuveesDuProducteur = async (id: string) => {
    if (!cuveesDe.has(id)) cuveesDe.set(id, await requete<CuveeBase>(
      `select c.id, c.nom, c.couleur::text, c.cepages, coalesce(t.nom, c.appellation_texte) as appellation, c.etiquette_url
         from cuvee c left join terroir t on t.id = c.appellation_id where c.producteur_id = $1 and c.statut <> 'retire'`, [id]));
    return cuveesDe.get(id)!;
  };
  // Le même producteur en double dans la base (« Château Mourgues du Grès - François Collard » validé à côté de
  // « Château Mourgues du Grès », « Weingut Battenfeld Spanier » à côté de « Battenfeld-Spanier ») : ses cuvées sont chez l'autre.
  const homonymes = new Map<string, { id: string; nom: string } | null>();
  const homonyme = async (v: VinPartage) => {
    const cle = v.producteur_id!;
    if (!homonymes.has(cle)) {
      let trouve: { id: string; nom: string } | null = null;
      for (const nom of new Set([v.producteur_nom, nomLu(v.producteur_texte)].filter((x): x is string => Boolean(x)))) {
        const p = await producteurConnu(requete, nom, { exclure: cle, memesMots: true });
        if (p) { trouve = { id: p.id, nom: p.nom }; break; }
      }
      homonymes.set(cle, trouve);
    }
    return homonymes.get(cle)!;
  };

  const touchees = new Set<string>();
  const clesTouchees = new Set<string>(); // étiquettes par nom (vins sans producteur)
  for (const v of lignes) {
    let cuvee = v.cuvee_id && v.cuvee_producteur === v.producteur_id && !v.cuvee_retiree ? v.cuvee_id : null;
    const aSaPhoto = Boolean(v.etiquette_url && v.etiquette_source && v.etiquette_source !== 'cuvee');
    if (!cuvee && v.producteur_id) {
      const liste = await cuveesDuProducteur(v.producteur_id);
      cuvee = cuveeCorrespondante(v, liste)?.id ?? null;
      const autre = cuvee ? null : await homonyme(v);
      if (autre) cuvee = cuveeCorrespondante({ ...v, producteur_texte: [nomLu(v.producteur_texte), autre.nom].filter(Boolean).join(' ') }, await cuveesDuProducteur(autre.id))?.id ?? null;
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
    // Vin sans producteur (donc sans cuvée) : sa photo est gardée sous son nom exact et sa couleur.
    if (!v.producteur_id) {
      const cle = cleLibelle(v.libelle, v.couleur);
      clesTouchees.add(cle);
      if (aSaPhoto) {
        await requete(
          `insert into etiquette_libelle (cle, libelle, couleur, etiquette_url, etiquette_source, vin_id) values ($1, $2, $3, $4, $5, $6)
           on conflict (cle) do update set etiquette_url = excluded.etiquette_url, etiquette_source = excluded.etiquette_source,
             vin_id = excluded.vin_id, maj_le = now()
            where $7 or coalesce(array_position(array['fichier', 'wine_labs', 'restaurant'], etiquette_libelle.etiquette_source), 0) < $8`,
          [cle, v.libelle, v.couleur, v.etiquette_url, v.etiquette_source, v.id, v.id === nouvellePhoto, ORDRE_SOURCE[v.etiquette_source!] ?? 0]);
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
  // Étiquette gardée par nom → vins sans producteur et sans photo propre portant ce nom (toutes les cartes).
  let recuesParNom = 0;
  if (clesTouchees.size) {
    const etiquettes = new Map((await requete<{ cle: string; etiquette_url: string }>(
      'select cle, etiquette_url from etiquette_libelle where cle = any($1)', [[...clesTouchees]])).map((e) => [e.cle, e.etiquette_url]));
    const candidats = await requete<{ id: string; libelle: string; couleur: string; etiquette_url: string | null }>(
      `select id, libelle, couleur::text, etiquette_url from vin_carte
        where producteur_id is null and (etiquette_url is null or etiquette_source = 'cuvee')`);
    for (const c of candidats) {
      const url = etiquettes.get(cleLibelle(c.libelle, c.couleur));
      if (!url || url === c.etiquette_url) continue;
      await requete(`update vin_carte set etiquette_url = $2, etiquette_source = 'cuvee', etiquette_statut = 'trouvee' where id = $1`, [c.id, url]);
      recuesParNom++;
    }
  }
  if (!touchees.size) return recuesParNom;

  // Étiquette de la cuvée → vins sans photo propre (toutes les cartes).
  const recues = await requete<{ id: string }>(
    `update vin_carte v set etiquette_url = c.etiquette_url, etiquette_source = 'cuvee', etiquette_statut = 'trouvee'
       from cuvee c
      where v.cuvee_id = c.id and c.id = any($1) and c.etiquette_url is not null
        and (coalesce(v.etiquette_url, '') = '' or v.etiquette_source = 'cuvee') and v.etiquette_url is distinct from c.etiquette_url
      returning v.id`, [[...touchees]]);
  // Vin qui avait hérité d'une étiquette et n'est plus rattaché à cette cuvée (producteur changé) : il la perd.
  await requete(
    `update vin_carte v set etiquette_url = null, etiquette_source = null, etiquette_statut = null
      where v.etiquette_source = 'cuvee' and ($1::text[] is null or v.id = any($1) or v.cuvee_id = any($2))
        and not exists (select 1 from cuvee c where c.id = v.cuvee_id and c.etiquette_url = v.etiquette_url)
        and not (v.producteur_id is null and exists (select 1 from etiquette_libelle e where e.etiquette_url = v.etiquette_url))`,
    [vins ?? null, [...touchees]]);
  return recues.length + recuesParNom;
}
