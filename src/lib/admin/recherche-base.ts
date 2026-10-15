import 'server-only';
// Recherche d'un vin dans la base de Pat à partir de l'intitulé tapé par le restaurant (ajout d'un vin à la carte).
// Sources : les cuvées de la base (avec leur producteur et leur appellation) et les vins déjà connus des cartes.
// Ne renvoie que des descriptions (couleur, région, appellation, nom, cépages, producteur) : jamais de prix ni de classement.
import { requete } from '@/lib/db';

export type VinTrouve = {
  cle: string; libelle: string; couleur: string | null; section: string | null; appellation: string | null;
  nom_vin: string | null; cepages: string | null; producteur: string | null; complet: boolean;
};

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
export async function chercherVinsBase(texte: string): Promise<VinTrouve[]> {
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
              v.nom_vin, coalesce(c.cepages, v.cepages) as cepages, p.nom as producteur
         from cuvee c join producteur p on p.id = c.producteur_id left join terroir t on t.id = c.appellation_id
         left join lateral (select x.couleur::text as couleur, x.section, x.appellation_texte, x.nom_vin, x.cepages from vin_carte x where x.cuvee_id = c.id
                             order by (x.nom_vin is not null)::int + (x.cepages is not null)::int + (x.appellation_texte is not null)::int desc limit 1) v on true
        where ${SQL_NORM("c.nom || ' ' || p.nom || ' ' || coalesce(c.appellation_texte, t.nom, '')")} like any($1)
       union all
       select distinct on (lower(x.libelle), x.couleur) 'carte' as source, x.id, x.libelle, x.couleur::text, x.section,
              coalesce(x.appellation_texte, t.nom), x.nom_vin, x.cepages, coalesce(p.nom, x.producteur_texte)
         from vin_carte x left join producteur p on p.id = x.producteur_id left join terroir t on t.id = x.appellation_id
        where x.cuvee_id is null and ${SQL_NORM("x.libelle || ' ' || coalesce(p.nom, x.producteur_texte, '')")} like any($1)
     ) r limit 400`, [motifs]);

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

  const vus = new Set<string>();
  const sortie: VinTrouve[] = [];
  for (const { l, part } of notes) {
    const cle = `${norm(l.libelle)}|${l.couleur ?? ''}|${norm(l.producteur ?? '')}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({ cle: `${l.source}:${l.id}`, libelle: l.libelle, couleur: l.couleur, section: l.section, appellation: l.appellation,
      nom_vin: l.nom_vin, cepages: l.cepages, producteur: l.producteur ?? null, complet: part === 1 });
    if (sortie.length >= 8) break;
  }
  return sortie;
}
