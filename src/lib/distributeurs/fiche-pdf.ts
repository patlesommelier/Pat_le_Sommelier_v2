// Photo de bouteille tirée de la fiche technique PDF d'un vin, quand la photo du site est trop petite pour lire l'étiquette.
// Chez Cinoco, la photo de l'article (« …/Item/17411012.webp », 127 pixels de large) a sa fiche technique à côté
// (« …/Item/17411012.pdf »), avec la bouteille en grand. Sans « server-only » : utilisé en arrière-plan.
import sharp from 'sharp';
import { COTE_MINIMUM } from './recadrage';

/** Adresse de la fiche PDF à côté d'une image (même nom, extension .pdf) ; null si l'adresse n'est pas celle d'une image. */
export function adresseFichePdf(urlImage: string): string | null {
  const pdf = urlImage.replace(/\.(webp|jpe?g|png|gif)(?=($|\?))/i, '.pdf');
  return pdf === urlImage ? null : pdf;
}

/** Plus grande image « bouteille » (en hauteur, assez grande) de la fiche, en JPEG ; null s'il n'y en a pas. */
export async function photoDeLaFichePdf(urlImage: string): Promise<{ octets: Buffer; type: string } | null> {
  const adresse = adresseFichePdf(urlImage);
  if (!adresse) return null;
  try {
    const r = await fetch(adresse, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const octets = new Uint8Array(await r.arrayBuffer());
    // « %PDF- » dans le premier kilo-octet (les fiches de Cinoco ont quelques octets avant).
    if (octets.length > 15 * 1024 * 1024 || !Buffer.from(octets.subarray(0, 1024)).toString('latin1').includes('%PDF-')) return null;
    const { getDocumentProxy, getResolvedPDFJS } = await import('unpdf');
    const { OPS } = await getResolvedPDFJS();
    const doc = await getDocumentProxy(octets, { verbosity: 0 } as never);
    let meilleure: { largeur: number; hauteur: number; donnees: Uint8Array | Uint8ClampedArray; canaux: number } | null = null;
    for (let p = 1; p <= Math.min(doc.numPages, 2); p++) {
      const page = await doc.getPage(p);
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] !== OPS.paintImageXObject) continue;
        const nom = String(ops.argsArray[i][0]);
        const img = await new Promise<{ width: number; height: number; data?: Uint8Array | Uint8ClampedArray } | null>((res) => {
          const t = setTimeout(() => res(null), 5000);
          (nom.startsWith('g_') ? page.commonObjs : page.objs).get(nom, (x: unknown) => { clearTimeout(t); res(x as never); });
        });
        if (!img?.data || img.height < img.width * 1.5 || Math.min(img.width, img.height) < COTE_MINIMUM) continue; // pas une bouteille en grand
        const canaux = img.data.length / (img.width * img.height);
        if (canaux !== 3 && canaux !== 4) continue;
        if (!meilleure || img.width * img.height > meilleure.largeur * meilleure.hauteur) meilleure = { largeur: img.width, hauteur: img.height, donnees: img.data, canaux };
      }
    }
    await doc.destroy();
    if (!meilleure) return null;
    const jpeg = await sharp(Buffer.from(meilleure.donnees), { raw: { width: meilleure.largeur, height: meilleure.hauteur, channels: meilleure.canaux as 3 | 4 } })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
    return { octets: jpeg, type: 'image/jpeg' };
  } catch (e) {
    console.error('[fiche-pdf]', adresse, (e as Error).message);
    return null;
  }
}
