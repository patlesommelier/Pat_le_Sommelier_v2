// Bon de commande d'une commande de vin, en PDF (ouvert dans le navigateur, à enregistrer ou à joindre à un e-mail).
import { exigerAcces } from '@/lib/admin/auth';
import { donneesBon } from '@/lib/admin/stocks';
import { genererBonCommande, referenceCommande } from '@/lib/bon-commande';

export async function GET(_: Request, { params }: { params: Promise<{ resto: string; id: string }> }) {
  const { resto, id } = await params;
  await exigerAcces(resto);
  const bon = await donneesBon(resto, id);
  if (!bon) return new Response('Commande introuvable', { status: 404 });
  return new Response(Buffer.from(genererBonCommande(bon)), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="bon-de-commande-${referenceCommande(bon)}.pdf"`, 'cache-control': 'no-store' },
  });
}
