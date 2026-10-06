// QR code « Scannez pour essayer » de la page d'accueil : il ouvre l'app de démonstration
// (NEXT_PUBLIC_DEMO_URL, sinon l'app de Lola sur ce site).
import { qrSvg } from '@/lib/qr-image';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_DEMO_URL || `${new URL(req.url).origin}/lola`;
  return new Response(await qrSvg(url), { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' } });
}
