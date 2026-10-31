// Étiquettes des vins d'un tarif collé depuis le site du distributeur : l'image de chaque article (trouvée par sa référence)
// est copiée dans notre stockage, puis donnée à la cuvée de la base de Pat qui n'en a pas encore.
// Sans « server-only » : lancé à la lecture du tarif, en arrière-plan.
import { createHash } from 'node:crypto';
import type { Requete } from '../generation/accords';
import { enProduction } from '../production';
import { configStockage, deposerObjet } from '../stockage';
import { adresseDuCollage, imagesParReference } from './sources';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Copie une image du site du distributeur dans notre stockage ; null si elle n'est pas accessible (site réservé aux clients connectés…). */
async function copier(url: string, nom: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { accept: 'image/*' } });
    const type = (r.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!r.ok || !TYPES[type]) return null;
    const octets = Buffer.from(await r.arrayBuffer());
    if (!octets.length || octets.length > 5 * 1024 * 1024) return null;
    const c = configStockage();
    if (!c) return enProduction() ? null : url; // en développement, sans stockage : l'image reste chez le distributeur
    return await deposerObjet(`distributeurs/${nom}-${createHash('sha1').update(octets).digest('hex').slice(0, 10)}.${TYPES[type]}`, octets, type, c);
  } catch {
    return null;
  }
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
 * Images de la page collée : reliées aux vins par leur référence d'article, copiées (quatre à la fois) puis partagées aux cuvées.
 * Renvoie le nombre de vins du tarif qui ont une image sur la page, et de ceux qui ont maintenant leur étiquette.
 */
export async function etiquettesDuCollage(requete: Requete, distributeurId: string, html: string) {
  const images = imagesParReference(html, adresseDuCollage(html));
  if (!images.size) return { trouvees: 0, copiees: 0 };
  await requete(
    `update distributeur_vin v set image_source = x.url, etiquette_url = case when v.image_source is distinct from x.url then null else v.etiquette_url end
       from unnest($2::text[], $3::text[]) as x(reference, url) where v.distributeur_id = $1 and v.reference = x.reference`,
    [distributeurId, [...images.keys()], [...images.values()]]);
  const a = await requete<{ id: string; reference: string; image_source: string }>(
    `select id, reference, image_source from distributeur_vin where distributeur_id = $1 and image_source is not null and etiquette_url is null`, [distributeurId]);
  for (let i = 0; i < a.length; i += 4) {
    await Promise.all(a.slice(i, i + 4).map(async (v) => {
      const url = await copier(v.image_source, `${distributeurId.slice(0, 8)}-${v.reference.toLowerCase().replace(/[^a-z0-9]+/g, '')}`);
      if (url) { await requete('update distributeur_vin set etiquette_url = $2 where id = $1', [v.id, url]); }
    }));
  }
  await partagerEtiquettesDistributeur(requete, distributeurId);
  // Vins du tarif qui ont une image sur la page (les articles ignorés, à 0 €, ne comptent pas), et ceux qui ont maintenant leur étiquette.
  const [r] = await requete<{ trouvees: number; copiees: number }>(
    `select count(*)::int as trouvees, count(etiquette_url)::int as copiees from distributeur_vin
      where distributeur_id = $1 and actif and reference = any($2) and image_source is not null`, [distributeurId, [...images.keys()]]);
  return r;
}
