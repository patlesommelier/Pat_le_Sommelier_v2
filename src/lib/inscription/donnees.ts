// Données reconnues par Pat sur le menu et la carte, validées avant d'être enregistrées.
import { z } from 'zod';
import { estTailleVerre } from '../contenances';

/** Catégories des plats de l'app (enum categorie_plat). */
export const CATEGORIES = ['entree', 'plat', 'dessert', 'fromage'] as const;

export const Plat = z.object({
  nom: z.string().trim().min(1).max(160),
  categorie: z.enum(CATEGORIES).catch('plat'),
  description: z.string().trim().max(500).nullable().default(null),
  prix: z.number().nonnegative().max(10000).nullish().catch(null), // absent des inscriptions antérieures
  prixVariantes: z.string().trim().max(120).nullish().catch(null),
});
export type Plat = z.infer<typeof Plat>;

export const COULEURS = ['bulles', 'blanc', 'rose', 'orange', 'rouge', 'doux', 'sans_alcool'] as const;

export const Vin = z.object({
  libelleCarte: z.string().trim().min(1).max(200),
  producteur: z.string().trim().max(120).nullable().default(null),
  appellation: z.string().trim().max(120).nullable().default(null),
  millesime: z.string().trim().regex(/^(19|20)\d{2}(-(19|20)\d{2})?$/).nullable().default(null),
  contenance: z.string().trim().max(20).nullable().default(null),
  prix: z.number().nonnegative().max(100000).nullable().default(null),
  prixVerre: z.number().nonnegative().max(10000).nullable().default(null),
  auVerre: z.boolean().default(false),
  couleur: z.enum(COULEURS),
  region: z.string().trim().max(80).nullable().default(null),
  // Cépages indiqués sur la carte (absents des inscriptions antérieures).
  cepages: z.string().trim().max(200).nullish().catch(null),
});
export type Vin = z.infer<typeof Vin>;

/** Vin reconnu, rattaché (ou non) à la base de Pat. Aucun ranking ici : c'est ce que voit le restaurateur. */
export type VinRapproche = Vin & { vinId: string | null; producteurStatut: 'reference' | 'nouveau' };

/** Valide une liste en gardant les éléments corrects et en comptant les rejets. */
export function validerListe<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, brut: unknown): { ok: T[]; rejetes: number } {
  const liste = Array.isArray(brut) ? brut : [];
  const ok: T[] = [];
  let rejetes = 0;
  for (const x of liste) {
    const r = schema.safeParse(x);
    if (r.success) ok.push(r.data); else rejetes++;
  }
  return { ok, rejetes };
}

export function resumeVins(vins: VinRapproche[]) {
  const parCouleur = Object.fromEntries(COULEURS.map((c) => [c, vins.filter((v) => v.couleur === c).length]));
  return {
    total: vins.length,
    parCouleur,
    sansProducteur: vins.filter((v) => !v.producteur).map((v) => v.libelleCarte),
  };
}

// Un même plat ou vin lu deux fois (pages qui se chevauchent sur deux photos) n'est gardé qu'une fois.
const cle = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const dedoublonnerPlats = (p: Plat[]) => [...new Map(p.map((x) => [cle(x.nom), x])).values()];
export const dedoublonnerVins = (v: Vin[]) =>
  [...new Map(v.map((x) => [`${cle(x.libelleCarte)}|${x.millesime ?? ''}|${x.contenance ?? ''}`, x])).values()];

/**
 * Vin servi au verre en plusieurs tailles de verre (12 cl et 15 cl) : seul le prix du plus petit est gardé, les autres lignes
 * sont retirées. Les bouteilles (75 cl, demi, magnum…) et les pichets ou carafes (¼, ½) restent, avec ce prix au verre.
 */
export function unSeulVerre(vins: Vin[]): Vin[] {
  const auVerre = (v: Vin) => v.auVerre || estTailleVerre(v.contenance);
  const groupes = new Map<string, Vin[]>();
  for (const v of vins) {
    const k = `${v.couleur}|${cle(v.libelleCarte)}|${v.millesime ?? ''}`;
    groupes.set(k, [...groupes.get(k) ?? [], v]);
  }
  const remplaces = new Map<Vin, Vin | null>();
  for (const g of groupes.values()) {
    const verres = g.filter(auVerre);
    const offres = verres.length + g.filter((v) => !auVerre(v) && v.prixVerre != null).length;
    if (offres < 2) continue;
    const prix = g.flatMap((v) => [auVerre(v) ? v.prix ?? v.prixVerre : null, v.prixVerre]).filter((p): p is number => p != null);
    const plusPetit = prix.length ? Math.min(...prix) : null;
    const bouteilles = g.filter((v) => !auVerre(v));
    for (const v of verres) remplaces.set(v, null);
    if (bouteilles.length) for (const b of bouteilles) remplaces.set(b, { ...b, prixVerre: plusPetit });
    else remplaces.set(verres[0], { ...verres[0], auVerre: true, contenance: null, prix: plusPetit, prixVerre: null });
  }
  return vins.flatMap((v) => { const r = remplaces.has(v) ? remplaces.get(v) : v; return r ? [r] : []; });
}
