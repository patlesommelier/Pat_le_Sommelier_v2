// QR code « Scannez pour essayer » de la page d'accueil : il ouvre l'app de démonstration
// (NEXT_PUBLIC_DEMO_URL, sinon l'app de démo « Chez Pat » sur ce site).
import { qrSvg } from '@/lib/qr-image';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const adresse = new URL(req.url);
  const url = process.env.NEXT_PUBLIC_DEMO_URL || `${adresse.origin}/chez-pat`;
  // ?couleur=pat : rouge de Pat sur le crème de la page d'accueil
  const pat = adresse.searchParams.get('couleur') === 'pat';
  return new Response(await (pat ? qrSvg(url, '#FF0D05', '#FEFAF1') : qrSvg(url)), { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' } });
}
