import 'server-only';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { supabaseConfigure, supabaseService } from './supabase';

const BUCKET = 'medias';
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const MAX = 5 * 1024 * 1024;

/**
 * Dépose une image (logo, étiquette) et renvoie son adresse publique.
 * En ligne : Supabase Storage, compartiment public « medias » (créé au premier dépôt).
 * En local sans Supabase : public/uploads (jamais sur Netlify, dont le disque n'est pas conservé).
 */
export async function deposerImage(fichier: File, dossier: string): Promise<string> {
  const ext = TYPES[fichier.type];
  if (!ext) throw new Error('Format accepté : PNG, JPG, WebP ou SVG.');
  if (fichier.size > MAX) throw new Error('Image trop lourde (5 Mo au maximum).');
  const nom = `${dossier.replace(/[^a-z0-9/_-]/gi, '')}/${randomUUID()}.${ext}`;
  const octets = Buffer.from(await fichier.arrayBuffer());

  if (supabaseConfigure() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const sb = supabaseService();
    const { data: seaux } = await sb.storage.listBuckets();
    if (!seaux?.some((b) => b.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: true });
    const { error } = await sb.storage.from(BUCKET).upload(nom, octets, { contentType: fichier.type, upsert: false });
    if (error) throw new Error(`Dépôt impossible : ${error.message}`);
    return sb.storage.from(BUCKET).getPublicUrl(nom).data.publicUrl;
  }
  if (process.env.NETLIFY) throw new Error('Stockage non configuré : SUPABASE_SERVICE_ROLE_KEY manquante.');
  const cible = path.join(process.cwd(), 'public', 'uploads', nom);
  await fs.mkdir(path.dirname(cible), { recursive: true });
  await fs.writeFile(cible, octets);
  return `/uploads/${nom}`;
}
