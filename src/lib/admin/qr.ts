import 'server-only';
import { headers } from 'next/headers';

/** Adresse publique de l'app d'un restaurant (celle que le QR code ouvre). */
export async function adresseApp(resto: string) {
  const base = process.env.URL_PUBLIQUE?.replace(/\/$/, '');
  if (base) return `${base}/${resto}`;
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/${resto}`;
}

export { qrPng, qrSvg } from '../qr-image';
