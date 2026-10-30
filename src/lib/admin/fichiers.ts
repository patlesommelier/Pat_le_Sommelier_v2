import 'server-only';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { enProduction } from '../production';
import { configStockage, deposerObjet } from '../stockage';

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const MAX = 5 * 1024 * 1024;

/**
 * Dépose une image (logo, étiquette, photo de plat) et renvoie son adresse publique.
 * En ligne : le stockage Hetzner (STOCKAGE_S3_…).
 * En local sans stockage configuré : public/uploads (jamais en production, où le disque n'est pas conservé).
 */
export async function deposerImage(fichier: File, dossier: string): Promise<string> {
  const ext = TYPES[fichier.type];
  if (!ext) throw new Error('Format accepté : PNG, JPG, WebP ou SVG.');
  if (fichier.size > MAX) throw new Error('Image trop lourde (5 Mo au maximum).');
  const nom = `${dossier.replace(/[^a-z0-9/_-]/gi, '')}/${randomUUID()}.${ext}`;
  const octets = Buffer.from(await fichier.arrayBuffer());

  if (configStockage()) return deposerObjet(nom, octets, fichier.type);
  if (enProduction()) throw new Error('Stockage des images non configuré (variables STOCKAGE_S3_…).');
  const cible = path.join(process.cwd(), 'public', 'uploads', nom);
  await fs.mkdir(path.dirname(cible), { recursive: true });
  await fs.writeFile(cible, octets);
  return `/uploads/${nom}`;
}
