// Serveur : une image « vide » (toute blanche, toute transparente ou d'une seule couleur), comme les images « pas de photo »
// des sites de distributeurs. Elle ne doit jamais servir d'étiquette.
import sharp from 'sharp';

export async function estImageVide(octets: Buffer): Promise<boolean> {
  try {
    const n = 32;
    const { data } = await sharp(octets).resize(n, n, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let min = 255, max = 0, opaques = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 24) continue; // pixel transparent
      opaques++;
      const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    return opaques < (n * n) / 20 || max - min < 12;
  } catch { return false; } // illisible par sharp : on ne décide pas
}
