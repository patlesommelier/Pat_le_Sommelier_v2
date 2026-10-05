// Aperçu du logo envoyé pendant l'inscription : servi seulement à cette inscription (cookie), jamais en public.
import { requete } from '@/lib/db';
import { inscriptionCourante } from '@/lib/inscription/etat';

export const dynamic = 'force-dynamic';

export async function GET() {
  const i = await inscriptionCourante();
  if (!i?.logo_fichier) return new Response('Introuvable', { status: 404 });
  const [f] = await requete<{ media_type: string; octets: Buffer }>(
    'select media_type, octets from inscription_fichier where id = $1 and inscription_id = $2', [i.logo_fichier, i.id]);
  if (!f) return new Response('Introuvable', { status: 404 });
  return new Response(new Uint8Array(f.octets), {
    headers: {
      'content-type': f.media_type, 'cache-control': 'private, no-store',
      // Un SVG est servi comme image seulement : aucun script ne peut s'exécuter dans le contexte du site.
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", 'x-content-type-options': 'nosniff',
    },
  });
}
