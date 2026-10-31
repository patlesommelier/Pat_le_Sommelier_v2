// Dernier tarif (PDF, Excel, CSV ou texte collé) d'un distributeur : réservé au super-admin (il contient les prix d'achat de Quid Vinum).
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerAdmin();
  const { id } = await params;
  const [t] = await requete<{ nom: string; octets: Buffer; media_type: string }>('select nom, octets, media_type from distributeur_tarif where distributeur_id = $1 order by cree_le desc limit 1', [id]);
  if (!t) return new Response('Aucun tarif.', { status: 404 });
  return new Response(new Uint8Array(t.octets), { headers: {
    'content-type': t.media_type === 'text/plain' ? 'text/plain; charset=utf-8' : t.media_type, 'cache-control': 'private, no-store',
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(t.nom)}`,
  } });
}
