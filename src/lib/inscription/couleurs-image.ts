// Lecture des pixels d'un logo avec sharp (disponible sur les fonctions Netlify).
import sharp from 'sharp';
import { couleursProposees } from './couleurs';

export async function couleursDuLogo(fichier: Buffer) {
  const { data } = await sharp(fichier, { density: 72 })
    .resize(96, 96, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return couleursProposees(data);
}

/** Le logo est-il clair (posable sur une couleur) ? Moyenne de luminosité des pixels opaques. */
export async function logoEstClair(fichier: Buffer) {
  const { data } = await sharp(fichier).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let somme = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    somme += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255; n++;
  }
  return n > 0 && somme / n > 0.7;
}
