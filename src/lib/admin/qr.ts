import 'server-only';
import { headers } from 'next/headers';
import QRCode from 'qrcode';

/** Adresse publique de l'app d'un restaurant (celle que le QR code ouvre). */
export async function adresseApp(resto: string) {
  const base = process.env.URL_PUBLIQUE?.replace(/\/$/, '');
  if (base) return `${base}/${resto}`;
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/${resto}`;
}

export const qrSvg = (url: string, couleur = '#24151A') =>
  QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: couleur, light: '#FFFFFF' } });

export const qrPng = (url: string) => QRCode.toBuffer(url, { type: 'png', margin: 2, width: 1200, errorCorrectionLevel: 'M' });
