// Avancement de la préparation des accords, interrogé toutes les 5 secondes par l'écran du QR code.
// Seulement des compteurs : aucune donnée d'accord ne transite ici.
import { NextResponse } from 'next/server';
import { requete } from '@/lib/db';
import { etatDernierLot } from '@/lib/generation/file';
import { inscriptionCourante } from '@/lib/inscription/etat';

export const dynamic = 'force-dynamic';

export async function GET() {
  const i = await inscriptionCourante();
  if (!i) return NextResponse.json({ statut: 'aucune' }, { status: 404 });
  if (!i.restaurant_id) return NextResponse.json({ statut: i.statut });
  const [[r], lot] = await Promise.all([
    requete<{ statut: string }>('select statut from restaurant where id = $1', [i.restaurant_id]),
    etatDernierLot(requete, i.restaurant_id),
  ]);
  return NextResponse.json({
    statut: i.statut,
    restaurant: r?.statut,
    preparation: {
      statut: !lot ? 'en_attente' : lot.termine ? (lot.erreurs.length && !lot.faits ? 'erreur' : 'fait') : 'en_cours',
      total: lot?.total ?? 0, faits: (lot?.faits ?? 0) + (lot?.erreurs.length ?? 0),
    },
  });
}
