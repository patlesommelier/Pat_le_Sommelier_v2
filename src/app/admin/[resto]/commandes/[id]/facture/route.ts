// Facture d'une commande (PDF joint par Quid Vinum) : servie au restaurant de la commande et au super-admin seulement.
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ resto: string; id: string }> }) {
  const { resto, id } = await params;
  await exigerAcces(resto);
  const [f] = await requete<{ nom: string; octets: Buffer }>(
    `select f.nom, f.octets from facture_commande f join commande c on c.id = f.commande_id where f.commande_id = $1 and c.restaurant_id = $2`, [id, resto]);
  if (!f) return new Response('Facture introuvable', { status: 404 });
  return new Response(new Uint8Array(f.octets), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${f.nom.replace(/[^\w.\- ]+/g, '_')}"`, 'cache-control': 'private, no-store' },
  });
}
