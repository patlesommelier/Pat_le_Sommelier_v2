// Nombre de commandes Quid Vinum avec une nouveauté (statut changé, facture jointe) depuis la dernière visite du restaurant (pastille du menu).
import { exigerAcces } from '@/lib/admin/auth';
import { commandesAVoir } from '@/lib/admin/stocks';

export async function GET(_: Request, { params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  return Response.json({ n: await commandesAVoir(resto) }, { headers: { 'cache-control': 'private, no-store' } });
}
