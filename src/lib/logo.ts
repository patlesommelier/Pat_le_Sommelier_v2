import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { deposerImage } from './admin/fichiers';
import { requete } from './db';

/**
 * Logo prêt pour le bandeau de l'app : marges vides (transparentes ou de la couleur du bord) retirées,
 * et proportions mesurées. Un SVG est gardé tel quel (proportions lues seulement).
 */
export async function preparerLogo(octets: Buffer, type: string): Promise<{ octets: Buffer; type: string; ratio: number }> {
  if (type === 'image/svg+xml') {
    const m = await sharp(octets).metadata();
    return { octets, type, ratio: m.width && m.height ? m.width / m.height : 0 };
  }
  const { data, info } = await sharp(octets).rotate().trim({ threshold: 12 }).png().toBuffer({ resolveWithObject: true });
  return { octets: data, type: 'image/png', ratio: info.width / info.height };
}

/** Prépare un logo envoyé depuis « Apparence », le dépose et renvoie son adresse et ses proportions. */
export async function deposerLogo(fichier: File, dossier: string): Promise<{ url: string; ratio: number }> {
  const brut = Buffer.from(await fichier.arrayBuffer());
  let pret: { octets: Buffer; type: string; ratio: number };
  try {
    pret = await preparerLogo(brut, fichier.type);
  } catch {
    pret = { octets: brut, type: fichier.type, ratio: 0 }; // image que sharp ne sait pas lire : déposée telle quelle
  }
  const nom = fichier.name.replace(/\.\w+$/, '') + (pret.type === 'image/png' ? '.png' : '');
  const url = await deposerImage(new File([new Uint8Array(pret.octets)], nom, { type: pret.type }), dossier);
  return { url, ratio: pret.ratio };
}

/**
 * Logo déposé avant cette amélioration (restaurant inscrit) : rogné et mesuré une seule fois, au premier affichage.
 * Renvoie les proportions (0 si l'image n'a pas pu être lue).
 */
export async function reparerLogo(restaurantId: string, logoUrl: string): Promise<number> {
  let ratio = 0;
  try {
    const octets = logoUrl.startsWith('/')
      ? await fs.readFile(path.join(process.cwd(), 'public', logoUrl))
      : Buffer.from(await (await fetch(logoUrl, { signal: AbortSignal.timeout(10_000) })).arrayBuffer());
    const type = (await sharp(octets).metadata()).format === 'svg' ? 'image/svg+xml' : 'image/png';
    const pret = await preparerLogo(octets, type);
    ratio = pret.ratio;
    const avant = await sharp(octets).metadata();
    // Marges importantes retirées : le logo rogné remplace l'ancien.
    if (type !== 'image/svg+xml' && avant.width && avant.height && (await sharp(pret.octets).metadata()).width! < avant.width * 0.9) {
      const url = await deposerImage(new File([new Uint8Array(pret.octets)], 'logo.png', { type: 'image/png' }), `${restaurantId}/logo`);
      await requete('update restaurant set logo_url = $2 where id = $1 and logo_url = $3', [restaurantId, url, logoUrl]);
    }
  } catch (e) {
    console.error('[logo]', restaurantId, e);
  }
  await requete('update restaurant set logo_ratio = $2 where id = $1', [restaurantId, ratio]);
  return ratio;
}
