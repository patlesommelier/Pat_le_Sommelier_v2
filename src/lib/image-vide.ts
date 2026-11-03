// Navigateur : une image chargée mais « vide » (toute blanche, toute transparente ou d'une seule couleur), comme les images
// « pas de photo » des sites de distributeurs gardées par erreur comme étiquettes. Elle est alors traitée comme absente.
// Image d'un autre site sans autorisation de lecture : impossible à examiner, elle est gardée.
export function imageVide(img: HTMLImageElement): boolean {
  if (!img.naturalWidth || !img.naturalHeight) return true;
  try {
    const n = 24;
    const toile = document.createElement('canvas');
    toile.width = n; toile.height = n;
    const ctx = toile.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, n, n);
    const p = ctx.getImageData(0, 0, n, n).data;
    let min = 255, max = 0, opaques = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 24) continue; // pixel transparent
      opaques++;
      const lum = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000;
      if (lum < min) min = lum; if (lum > max) max = lum;
    }
    // Presque tout transparent, ou une seule teinte (écart de luminosité minime) : rien à voir.
    return opaques < (n * n) / 20 || max - min < 12;
  } catch { return false; }
}
