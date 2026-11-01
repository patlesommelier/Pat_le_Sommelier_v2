// Bon de réception (PDF) d'une livraison d'une commande de vin : réception partielle ou complète.
import { exigerAcces } from '@/lib/admin/auth';
import { donneesReception } from '@/lib/admin/stocks';
import { genererBonReception, referenceCommande } from '@/lib/bon-commande';

export async function GET(_: Request, { params }: { params: Promise<{ resto: string; id: string; reception: string }> }) {
  const { resto, id, reception } = await params;
  await exigerAcces(resto);
  const d = await donneesReception(resto, id, reception);
  if (!d) return new Response('Réception introuvable', { status: 404 });
  return new Response(Buffer.from(genererBonReception(d.bon, d.reception)), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="bon-de-reception-${referenceCommande(d.bon)}-R${d.reception.numero}.pdf"`, 'cache-control': 'no-store' },
  });
}
