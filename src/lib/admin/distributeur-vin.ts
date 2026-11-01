import 'server-only';
// Vin d'un restaurant acheté chez un distributeur de Quid Vinum : le distributeur devient son fournisseur
// (avec la marge par défaut s'il ne l'était pas), le vin y est rattaché avec son prix d'achat (prix du restaurant, HTVA).
import { randomUUID } from 'node:crypto';
import { requete } from '@/lib/db';
import { offresDistributeurs } from '@/lib/admin/recherche-base';
import { margeDefaut } from '@/lib/distributeurs/donnees';
import { centilitres } from '@/lib/contenances';
import { offreDuCatalogue, type VinCatalogueComplet, type VinCarteComplet } from '@/lib/distributeurs/tarif';

export async function rattacherAuDistributeur(resto: string, vinIds: string[], offreId: string) {
  const [o] = await offresDistributeurs(resto, { vins: [offreId] });
  if (!o || !vinIds.length) return null;
  await requete(`insert into fournisseur (id, restaurant_id, nom, distributeur_id, marge) select $1, $2, $3, $4, $5
                  where not exists (select 1 from fournisseur where restaurant_id = $2 and distributeur_id = $4)`,
    [randomUUID(), resto, o.distributeur, o.distributeur_id, await margeDefaut()]);
  const [f] = await requete<{ id: string }>('select id from fournisseur where restaurant_id = $1 and distributeur_id = $2 limit 1', [resto, o.distributeur_id]);
  await requete(`update vin_carte set fournisseur_id = $3, distributeur_vin_id = $4, prix_achat = coalesce($5, prix_achat) where restaurant_id = $1 and id = any($2)`,
    [resto, vinIds, f?.id ?? null, o.id, o.prix]);
  return { ...o, fournisseur_id: f?.id ?? null };
}

/**
 * Vins de la carte vendus par un distributeur de Quid Vinum (par leur vin de la base), quand ce distributeur n'est pas déjà
 * leur fournisseur : la meilleure offre de chacun, au prix du restaurant. Jamais le prix QV ni la marge.
 */
export async function offresPourLaCarte(resto: string) {
  const vins = await requete<{ id: string; cuvee_id: string; distributeur_id: string | null }>(
    `select v.id, v.cuvee_id, f.distributeur_id from vin_carte v left join fournisseur f on f.id = v.fournisseur_id
      where v.restaurant_id = $1 and v.cuvee_id is not null`, [resto]);
  if (!vins.length) return new Map<string, Awaited<ReturnType<typeof offresDistributeurs>>[number]>();
  const offres = await offresDistributeurs(resto, { cuvees: [...new Set(vins.map((v) => v.cuvee_id))] });
  const parVin = new Map<string, (typeof offres)[number]>();
  for (const v of vins) {
    if (v.distributeur_id) continue; // déjà acheté chez un distributeur de Quid Vinum
    const o = offres.filter((x) => x.cuvee_id === v.cuvee_id && !x.epuise && x.prix != null).sort((a, b) => a.prix! - b.prix!)[0];
    if (o) parVin.set(v.id, o);
  }
  return parVin;
}

/**
 * Fournisseur d'un vin changé (page Vins, fiche du vin) : un distributeur de Quid Vinum → le vin est associé au vin
 * correspondant de son catalogue (prix d'achat, commande dans le catalogue) ; un autre fournisseur → le lien est retiré.
 * Renvoie vrai si le vin a été trouvé dans le catalogue.
 */
export async function associerAuCatalogue(resto: string, vinIds: string[], fournisseurId: string | null) {
  if (!vinIds.length) return false;
  const [f] = fournisseurId ? await requete<{ distributeur_id: string | null }>('select distributeur_id from fournisseur where id = $1 and restaurant_id = $2', [fournisseurId, resto]) : [];
  if (!f?.distributeur_id) {
    await requete('update vin_carte set distributeur_vin_id = null where restaurant_id = $1 and id = any($2)', [resto, vinIds]);
    return false;
  }
  const [vin] = await requete<VinCarteComplet>(
    `select v.id, v.libelle, v.millesime, v.format, v.producteur_id, coalesce(p.nom, v.producteur_texte) as producteur, v.couleur::text as couleur, v.cuvee_id
       from vin_carte v left join producteur p on p.id = v.producteur_id where v.restaurant_id = $1 and v.id = $2`, [resto, vinIds[0]]);
  const catalogue = await requete<VinCatalogueComplet>(
    `select v.id, v.libelle, v.millesime, v.contenance, v.producteur_id, coalesce(p.nom, v.producteur_texte) as producteur, v.couleur, v.cuvee_id
       from distributeur_vin v left join producteur p on p.id = v.producteur_id where v.distributeur_id = $1 and v.actif order by v.ordre`, [f.distributeur_id]);
  const offre = vin ? offreDuCatalogue(vin, catalogue) : null;
  if (!offre) {
    await requete('update vin_carte set distributeur_vin_id = null where restaurant_id = $1 and id = any($2)', [resto, vinIds]);
    return false;
  }
  await rattacherAuDistributeur(resto, vinIds, offre.id);
  // Vin de la carte pas encore relié à la base : il l'est au vin de la base du distributeur (même producteur).
  if (offre.cuvee_id) await requete(`update vin_carte v set cuvee_id = $3, producteur_id = coalesce(v.producteur_id, c.producteur_id)
                                      from cuvee c where c.id = $3 and v.restaurant_id = $1 and v.id = any($2) and v.cuvee_id is null
                                        and (v.producteur_id is null or v.producteur_id = c.producteur_id)`, [resto, vinIds, offre.cuvee_id]);
  return true;
}

/** Mots d'un vin blanc : la couleur, ou un cépage blanc (« Riesling », « Chardonnay »…). */
export const BLANCS = 'blanc|blanche|bianco|blanco|weiss|weisser|riesling|chardonnay|sauvignon|chenin|viognier|gewurztraminer|pinot gris|pinot blanc|sylvaner|muscat|gruner|veltliner|albarino|vermentino|grillo|catarratto|carricante|fiano|greco|falanghina|verdicchio|garganega|soave|chablis|sancerre|semillon|marsanne|roussanne|aligote|melon|muscadet|savagnin|jacquere|altesse|petite arvine|furmint|assyrtiko|godello|verdejo|txakoli|arneis|timorasso|friulano|ribolla';
const COULEURS_VIN = ['bulles', 'blanc', 'rose', 'orange', 'rouge', 'doux', 'sans_alcool'];
const CONTENANCE_CODE: Record<number, string> = { 75: 'bouteille', 37.5: 'demi', 18.7: 'quart', 150: 'magnum' };

/**
 * Vin du catalogue d'un distributeur commandé alors qu'il n'est pas dans les vins du restaurant : il y est ajouté
 * (stock 0, les bouteilles « en commande »), pas encore affiché sur la carte. Renvoie son identifiant.
 */
export async function ajouterVinCommande(resto: string, distributeurVinId: string, fournisseurId: string | null, prixAchat: number | null, enCommande: number) {
  const [d] = await requete<{ libelle: string; couleur: string | null; section: string | null; millesime: string | null; contenance: string | null;
    producteur_id: string | null; producteur: string | null; cuvee_id: string | null; couleur_cuvee: string | null }>(
    `select v.libelle, v.couleur, v.section, v.millesime, v.contenance, v.producteur_id, coalesce(p.nom, v.producteur_texte) as producteur, v.cuvee_id, c.couleur::text as couleur_cuvee
       from distributeur_vin v left join producteur p on p.id = v.producteur_id left join cuvee c on c.id = v.cuvee_id where v.id = $1`, [distributeurVinId]);
  if (!d) return null;
  const mots = d.libelle.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const devinee = /\b(champagne|cremant|prosecco|cava|brut|petillant|spumante|franciacorta|trento)\b/.test(mots) ? 'bulles'
    : /\b(rose|rosato|rosado)\b/.test(mots) ? 'rose' : new RegExp(`\\b(${BLANCS})\\b`).test(mots) ? 'blanc' : /\b(rouge|rosso|tinto|rot)\b/.test(mots) ? 'rouge' : null;
  const couleur = [d.couleur, d.couleur_cuvee, devinee].find((c) => c && COULEURS_VIN.includes(c)) ?? 'rouge';
  const cl = centilitres(d.contenance) ?? 75;
  const format = d.contenance && centilitres(d.contenance) ? d.contenance : '75 cl';
  let id = `${resto}-qv-${distributeurVinId.replace(/[^a-z0-9]+/gi, '').slice(0, 10).toLowerCase()}`;
  for (let n = 2; (await requete('select 1 from vin_carte where id = $1', [id])).length; n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
  await requete(
    `insert into vin_carte (id, restaurant_id, couleur, section, libelle, producteur_texte, producteur_id, cuvee_id, millesime, format, contenances,
                            ordre, disponible, stock, en_commande, fournisseur_id, distributeur_vin_id, prix_achat, modifie_bo)
     values ($1, $2, $3::couleur_vin, $4, $5, $6, $7, $8, $9, $10, $11, (select coalesce(max(ordre), 0) + 1 from vin_carte where restaurant_id = $2),
             false, 0, $12, $13, $14, $15, now())`,
    [id, resto, couleur, d.section, d.libelle, d.producteur, d.producteur_id, d.cuvee_id, d.millesime, format, [CONTENANCE_CODE[cl] ?? 'bouteille'],
      enCommande, fournisseurId, distributeurVinId, prixAchat]);
  return id;
}
