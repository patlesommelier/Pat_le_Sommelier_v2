// QR code de l'écran de fin d'inscription, autorisé par le cookie d'inscription (ce navigateur n'a pas
// forcément de session : l'adresse a pu être confirmée sur un autre appareil). ?format=png : téléchargement.
import { adresseApp, qrPng, qrSvg } from '@/lib/admin/qr';
import { inscriptionCourante } from '@/lib/inscription/etat';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const i = await inscriptionCourante();
  if (i?.statut !== 'finalisee' || !i.restaurant_id) return new Response('Introuvable', { status: 404 });
  const url = await adresseApp(i.restaurant_id);
  const png = new URL(req.url).searchParams.get('format') === 'png';
  const corps = png ? new Uint8Array(await qrPng(url)) : await qrSvg(url);
  return new Response(corps, {
    headers: {
      'content-type': png ? 'image/png' : 'image/svg+xml', 'cache-control': 'private, no-store',
      ...(png ? { 'content-disposition': `attachment; filename="qr-${i.restaurant_id}.png"` } : {}),
    },
  });
}
