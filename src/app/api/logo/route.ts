// Copie d'un logo du stockage, servie par le site (voir lib/logo-masque) : seulement depuis l'adresse publique du
// stockage des logos et seulement des images, 5 Mo au plus.
import { configStockage } from '@/lib/stockage';

const TYPES = /^image\/(png|jpeg|webp|svg\+xml|gif)$/;

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get('u') ?? '';
  const stockage = configStockage()?.urlPublique;
  let cible: URL;
  try { cible = new URL(u); } catch { return new Response('Adresse illisible', { status: 400 }); }
  if (!stockage || cible.origin !== new URL(stockage).origin) return new Response('Adresse non autorisée', { status: 403 });
  const r = await fetch(cible, { redirect: 'error' }).catch(() => null);
  const type = r?.headers.get('content-type')?.split(';')[0].trim() ?? '';
  if (!r?.ok || !TYPES.test(type)) return new Response('Logo introuvable', { status: 404 });
  const octets = await r.arrayBuffer();
  if (octets.byteLength > 5 * 1024 * 1024) return new Response('Logo trop lourd', { status: 413 });
  return new Response(octets, { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff',
    ...(type === 'image/svg+xml' ? { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}) } });
}
