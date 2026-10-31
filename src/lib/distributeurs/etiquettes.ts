// Étiquettes des vins d'un tarif venu du site du distributeur (texte collé, ou document Word) : l'image de chaque article,
// trouvée par sa référence, est copiée dans notre stockage, puis donnée à la cuvée de la base de Pat qui n'en a pas encore.
// Sans « server-only » : lancé à la lecture du tarif, en arrière-plan.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Requete } from '../generation/accords';
import { enProduction } from '../production';
import { configStockage, deposerObjet } from '../stockage';
import { adresseDuCollage, imagesParReference, type ImageArticle } from './sources';

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Image gardée chez nous (stockage Hetzner ; en développement sans stockage, public/uploads). */
async function garder(octets: Buffer, type: string, nom: string): Promise<string | null> {
  const ext = EXTENSIONS[type];
  if (!ext || !octets.length || octets.length > 5 * 1024 * 1024) return null;
  const fichier = `distributeurs/${nom}-${createHash('sha1').update(octets).digest('hex').slice(0, 10)}.${ext}`;
  const c = configStockage();
  if (c) return deposerObjet(fichier, octets, type, c);
  if (enProduction()) return null;
  const cible = path.join(process.cwd(), 'public', 'uploads', fichier);
  await fs.mkdir(path.dirname(cible), { recursive: true });
  await fs.writeFile(cible, octets);
  return `/uploads/${fichier}`;
}

/** Image du site du distributeur ; null si elle n'est pas accessible (site réservé aux clients connectés…). */
async function telecharger(url: string): Promise<{ octets: Buffer; type: string } | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { accept: 'image/*' } });
    const type = (r.headers.get('content-type') ?? '').split(';')[0].trim();
    return r.ok && EXTENSIONS[type] ? { octets: Buffer.from(await r.arrayBuffer()), type } : null;
  } catch {
    return null;
  }
}

/**
 * Photo trouvée sur le site du distributeur (adresse) : téléchargée, vérifiée (une vraie image, pas une icône) et gardée chez nous ;
 * null si elle n'est pas accessible ou n'en est pas une.
 */
export async function copierImageDuSite(url: string, nom: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const contenu = await telecharger(url);
  if (!contenu || contenu.octets.length < 3000) return null; // trop petite : icône, logo ou pixel
  return garder(contenu.octets, contenu.type, nom).catch(() => null);
}

/** Vins du distributeur qui ont une étiquette, donnée aux cuvées reliées qui n'en ont pas encore. */
export async function partagerEtiquettesDistributeur(requete: Requete, distributeurId: string) {
  await requete(
    `update cuvee c set etiquette_url = v.etiquette_url, etiquette_source = 'distributeur', etiquette_maj_le = now()
       from (select distinct on (cuvee_id) cuvee_id, etiquette_url from distributeur_vin
              where distributeur_id = $1 and cuvee_id is not null and etiquette_url is not null order by cuvee_id, maj_le desc) v
      where c.id = v.cuvee_id and c.etiquette_url is null`, [distributeurId]);
}

/**
 * Images reliées aux vins par leur référence d'article (adresse sur le site, ou image intégrée à un document Word),
 * copiées quatre à la fois, puis partagées aux cuvées. Renvoie le nombre de vins du tarif qui ont une image,
 * et de ceux qui ont maintenant leur étiquette.
 */
export async function appliquerImages(requete: Requete, distributeurId: string, images: Map<string, ImageArticle>) {
  if (!images.size) return { trouvees: 0, copiees: 0 };
  // Adresse d'origine (une image intégrée n'en a pas : son empreinte en tient lieu) ; une image changée est recopiée.
  const sources = [...images.entries()].map(([ref, img]) => [ref, 'url' in img ? img.url : `docx:${createHash('sha1').update(img.octets).digest('hex')}`] as const);
  await requete(
    `update distributeur_vin v set image_source = x.src, etiquette_url = case when v.image_source is distinct from x.src then null else v.etiquette_url end
       from unnest($2::text[], $3::text[]) as x(reference, src) where v.distributeur_id = $1 and v.reference = x.reference`,
    [distributeurId, sources.map((s) => s[0]), sources.map((s) => s[1])]);
  const a = await requete<{ id: string; reference: string }>(
    `select id, reference from distributeur_vin where distributeur_id = $1 and reference = any($2) and image_source is not null and etiquette_url is null`,
    [distributeurId, [...images.keys()]]);
  for (let i = 0; i < a.length; i += 4) {
    await Promise.all(a.slice(i, i + 4).map(async (v) => {
      const img = images.get(v.reference)!;
      const contenu = 'url' in img ? await telecharger(img.url) : img;
      const url = contenu ? await garder(contenu.octets, contenu.type, `${distributeurId.slice(0, 8)}-${v.reference.toLowerCase().replace(/[^a-z0-9]+/g, '')}`).catch(() => null) : null;
      if (url) await requete('update distributeur_vin set etiquette_url = $2 where id = $1', [v.id, url]);
    }));
  }
  await partagerEtiquettesDistributeur(requete, distributeurId);
  // Vins du tarif qui ont une image (les articles ignorés, à 0 €, ne comptent pas), et ceux qui ont maintenant leur étiquette.
  const [r] = await requete<{ trouvees: number; copiees: number }>(
    `select count(*)::int as trouvees, count(etiquette_url)::int as copiees from distributeur_vin
      where distributeur_id = $1 and actif and reference = any($2) and image_source is not null`, [distributeurId, [...images.keys()]]);
  return r;
}

/** Images de la version « page web » d'un collage. */
export const etiquettesDuCollage = (requete: Requete, distributeurId: string, html: string) =>
  appliquerImages(requete, distributeurId, new Map([...imagesParReference(html, adresseDuCollage(html))].map(([ref, url]) => [ref, { url }])));
