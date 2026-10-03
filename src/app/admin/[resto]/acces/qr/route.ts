import { exigerAcces } from '@/lib/admin/auth';
import { adresseApp, qrPng, qrSvg } from '@/lib/admin/qr';

/** Téléchargement du QR code : ?format=svg ou png. */
export async function GET(req: Request, { params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const url = await adresseApp(resto);
  const png = new URL(req.url).searchParams.get('format') === 'png';
  const corps = png ? new Uint8Array(await qrPng(url)) : await qrSvg(url);
  return new Response(corps, {
    headers: {
      'content-type': png ? 'image/png' : 'image/svg+xml',
      'content-disposition': `attachment; filename="qr-${resto}.${png ? 'png' : 'svg'}"`,
    },
  });
}
