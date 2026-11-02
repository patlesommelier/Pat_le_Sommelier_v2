import 'server-only';
// Recherche d'un vin dans la base de Pat à partir de l'intitulé tapé par le restaurant (ajout d'un vin à la carte).
// Sources : les cuvées de la base (avec leur producteur et leur appellation) et les vins déjà connus des cartes.
// Aussi les vins des catalogues des distributeurs de Quid Vinum (actifs) : le vin trouvé porte alors ses offres, au prix
// du restaurant (prix QV + sa marge, sinon la marge par défaut). Jamais le prix QV, la marge ni le classement.
import { requete } from '@/lib/db';
import { memeVinQue } from './doublons-recherche';
import { distributeurPermis } from '../distributeurs/verrou';

export type VinTrouve = {
  cle: string; libelle: string; couleur: string | null; section: string | null; appellation: string | null;
  nom_vin: string | null; cepages: string | null; producteur: string | null; etiquette: string | null; complet: boolean;
  millesime?: string | null; offres?: OffreDistributeur[];
};

/** Vin d'un distributeur de Quid Vinum, au prix du restaurant (HTVA). */
export type OffreDistributeur = { id: string; distributeur: string; distributeur_id: string; libelle: string; millesime: string | null; contenance: string | null; prix: number | null; epuise: boolean };

/** Offres des distributeurs actifs, par vin de la base (cuvée) ou par vin de distributeur, au prix du restaurant. */
export async function offresDistributeurs(resto: string, { cuvees = [] as string[], vins = [] as string[] } = {}) {
  if (!cuvees.length && !vins.length) return [] as (OffreDistributeur & { cuvee_id: string | null })[];
  const [m] = await requete<{ valeur: string }>(`select valeur from reglage_serveur where cle = 'qv_marge'`);
  const defaut = Number.isFinite(Number(m?.valeur)) ? Number(m?.valeur) : 15;
  return requete<OffreDistributeur & { cuvee_id: string | null }>(
    `select v.id, d.nom as distributeur, d.id as distributeur_id, v.libelle, v.millesime, v.contenance, v.cuvee_id, v.epuise,
            round(v.prix_qv * (1 + coalesce(f.marge, $3) / 100), 2)::float8 as prix
       from distributeur_vin v join distributeur d on d.id = v.distributeur_id and d.actif
       left join fournisseur f on f.distributeur_id = d.id and f.restaurant_id = $4
      where v.actif and (v.cuvee_id = any($1) or v.id = any($2)) and ${distributeurPermis('$4')} order by lower(d.nom), v.millesime desc nulls last, v.ordre`,
    [cuvees, vins, defaut, resto]);
}

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'en', 'au', 'aux', 'a', 'the', 'di', 'del', 'della', 'y']);
const GENERIQUES = new Set(['vin', 'cuvee', 'domaine', 'chateau', 'maison', 'aop', 'aoc', 'igp', 'doc', 'docg']);
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe');
const mots = (t: string | null | undefined) => (t ? norm(t).split(/[^a-z0-9]+/).filter((m) => m && !MOTS_VIDES.has(m)) : []);

// Texte normalisé côté SQL (minuscules, sans accents) pour le premier tri par mots.
const SQL_NORM = (x: string) => `translate(lower(${x}), 'àâäáãéèêëíìîïóòôöõúùûüçñœ', 'aaaaaeeeeiiiiooooouuuucno')`;

type Ligne = Omit<VinTrouve, 'cle' | 'complet'> & { source: string; id: string };

// Mots de couleur : ils ne servent pas à trouver le vin, mais départagent les cuvées d'un même nom.
const COULEURS: Record<string, string> = { rouge: 'rouge', blanc: 'blanc', rose: 'rose', bulles: 'bulles', effervescent: 'bulles',
  cremant: 'bulles', petillant: 'bulles', orange: 'orange', doux: 'doux', moelleux: 'doux', liquoreux: 'doux' };

/** Vins de la base les plus proches du texte tapé (« M de Minuty rosé 2025 »), 8 au plus, le plus sûr en premier. */
export async function chercherVinsBase(texte: string, resto?: string): Promise<VinTrouve[]> {
  const tous = mots(texte);
  const couleur = tous.map((m) => COULEURS[m]).find(Boolean) ?? null;
  // Le millésime et la couleur ne font pas partie du nom du vin.
  const cherches = [...new Set(tous.filter((m) => m.length >= 3 && !GENERIQUES.has(m) && !COULEURS[m] && !/^(19|20)\d\d$/.test(m)))].slice(0, 8);
  if (!cherches.length) return [];
  const motifs = cherches.map((m) => `%${m}%`);
  const lignes = await requete<Ligne>(
    `select * from (
       select 'cuvee' as source, c.id, c.nom as libelle, coalesce(c.couleur::text, v.couleur) as couleur,
              coalesce(v.section, t.sous_region, t.region) as section,
              coalesce(c.appellation_texte, t.nom, v.appellation_texte) as appellation,
              v.nom_vin, coalesce(c.cepages, v.cepages) as cepages, p.nom as producteur,
              coalesce(c.etiquette_url, (select e.etiquette_url from vin_carte e where e.cuvee_id = c.id and e.etiquette_url is not null limit 1)) as etiquette
         from cuvee c join producteur p on p.id = c.producteur_id left join terroir t on t.id = c.appellation_id
         left join lateral (select x.couleur::text as couleur, x.section, x.appellation_texte, x.nom_vin, x.cepages from vin_carte x where x.cuvee_id = c.id
                             order by (x.nom_vin is not null)::int + (x.cepages is not null)::int + (x.appellation_texte is not null)::int desc limit 1) v on true
        where ${SQL_NORM("c.nom || ' ' || p.nom || ' ' || coalesce(c.appellation_texte, t.nom, '')")} like any($1)
       union all
       select distinct on (lower(x.libelle), x.couleur) 'carte' as source, x.id, x.libelle, x.couleur::text, x.section,
              coalesce(x.appellation_texte, t.nom), x.nom_vin, x.cepages, coalesce(p.nom, x.producteur_texte), x.etiquette_url
         from vin_carte x left join producteur p on p.id = x.producteur_id left join terroir t on t.id = x.appellation_id
        where x.cuvee_id is null and ${SQL_NORM("x.libelle || ' ' || coalesce(p.nom, x.producteur_texte, '')")} like any($1)
       union all
       select 'distrib' as source, v.id, v.libelle, v.couleur, v.section, null, null, null, coalesce(p.nom, v.producteur_texte), v.etiquette_url
         from distributeur_vin v join distributeur d on d.id = v.distributeur_id and d.actif left join producteur p on p.id = v.producteur_id
        where v.actif and v.cuvee_id is null and ${distributeurPermis('$2')} and ${SQL_NORM("v.libelle || ' ' || coalesce(p.nom, v.producteur_texte, '')")} like any($1)
     ) r limit 400`, [motifs, resto ?? '']);

  const notes = lignes.map((l) => {
    const leurs = new Set([...mots(l.libelle), ...mots(l.producteur), ...mots(l.appellation), ...mots(l.nom_vin)]);
    const trouves = cherches.filter((m) => leurs.has(m) || [...leurs].some((x) => x.length >= 5 && m.length >= 5 && (x.startsWith(m) || m.startsWith(x)))).length;
    const remplis = [l.couleur, l.section, l.appellation, l.nom_vin, l.cepages, l.producteur].filter(Boolean).length;
    const bonneCouleur = couleur && l.couleur ? (l.couleur === couleur ? 1 : -1) : 0;
    return { l, part: trouves / cherches.length, remplis, surplus: leurs.size - trouves, bonneCouleur };
  }).filter((n) => n.part >= 0.6);
  // Des vins ont tous les mots tapés : les vins à moitié ressemblants ne sont pas proposés.
  if (notes.some((n) => n.part === 1)) notes.splice(0, notes.length, ...notes.filter((n) => n.part === 1));
  notes.sort((a, b) => b.part - a.part || b.bonneCouleur - a.bonneCouleur || b.remplis - a.remplis || a.surplus - b.surplus);

  // Vins de cartes non reliés qui sont un vin de la base (ou d'un distributeur) déjà trouvé : pas proposés deux fois ;
  // leur photo sert au vin de la base qui n'en a pas.
  const references = notes.filter((n) => n.l.source !== 'carte').map((n) => n.l);
  const doublons = new Set(notes.filter((n) => n.l.source === 'carte').map((n) => n.l).filter((c) => {
    const base = references.find((r) => memeVinQue(c, r));
    if (base && !base.etiquette && c.etiquette) base.etiquette = c.etiquette;
    return Boolean(base);
  }));
  const vus = new Set<string>();
  const sortie: VinTrouve[] = [];
  for (const { l, part } of notes) {
    const cle = `${norm(l.libelle)}|${l.couleur ?? ''}|${norm(l.producteur ?? '')}`;
    if (vus.has(cle) || doublons.has(l)) continue;
    vus.add(cle);
    sortie.push({ cle: `${l.source}:${l.id}`, libelle: l.libelle, couleur: l.couleur, section: l.section, appellation: l.appellation,
      nom_vin: l.nom_vin, cepages: l.cepages, producteur: l.producteur ?? null, etiquette: l.etiquette ?? null, complet: part === 1 });
    if (sortie.length >= 8) break;
  }
  if (!resto) return sortie;
  // Offres des distributeurs : pour les vins de la base (cuvées) et les vins de distributeur trouvés.
  const offres = await offresDistributeurs(resto, { cuvees: sortie.filter((v) => v.cle.startsWith('cuvee:')).map((v) => v.cle.slice(6)),
    vins: sortie.filter((v) => v.cle.startsWith('distrib:')).map((v) => v.cle.slice(8)) });
  for (const v of sortie) {
    const [type, ref] = v.cle.split(/:(.*)/s);
    v.offres = offres.filter((o) => (type === 'cuvee' ? o.cuvee_id === ref : type === 'distrib' && o.id === ref))
      .map(({ cuvee_id: _c, ...o }) => o); // eslint-disable-line @typescript-eslint/no-unused-vars
  }
  // Doublon dans la base (même vin sous un autre producteur, ex. « Orestadi ») sans distributeur : seul le vin vendu
  // par un distributeur est proposé ; sa photo sert à celui-ci s'il n'en a pas. Le doublon reste à fusionner par Pat.
  return sortie.filter((v) => {
    if (v.offres?.length) return true;
    const vendu = sortie.find((w) => w.offres?.length && memeVinQue(v, w));
    if (vendu && !vendu.etiquette && v.etiquette) vendu.etiquette = v.etiquette;
    return !vendu;
  });
}
