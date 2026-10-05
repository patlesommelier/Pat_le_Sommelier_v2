// QR code de l'écran de fin d'inscription, autorisé par le cookie d'inscription (ce navigateur n'a pas
// forcément de session : l'adresse a pu être confirmée sur un autre appareil). ?format=png : téléchargement.
import { adresseApp, qrPng, qrSvg } from '@/lib/admin/qr';
import { requete } from '@/lib/db';
import { inscriptionCourante } from '@/lib/inscription/etat';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const i = await inscriptionCourante();
  if (i?.statut !== 'finalisee' || !i.restaurant_id) return new Response('Introuvable', { status: 404 });
  // QR code seulement quand tous les plats ont leurs accords (restaurant en service).
  const [r] = await requete<{ statut: string }>('select statut from restaurant where id = $1', [i.restaurant_id]);
  if (r?.statut !== 'en_service') return new Response('Pas encore prêt', { status: 404 });
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
