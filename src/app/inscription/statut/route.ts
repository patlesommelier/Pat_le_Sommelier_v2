// Avancement de la préparation des accords, interrogé toutes les 5 secondes par l'écran du QR code.
// Seulement des compteurs : aucune donnée d'accord ne transite ici.
import { NextResponse } from 'next/server';
import { requete } from '@/lib/db';
import { inscriptionCourante } from '@/lib/inscription/etat';

export const dynamic = 'force-dynamic';

export async function GET() {
  const i = await inscriptionCourante();
  if (!i) return NextResponse.json({ statut: 'aucune' }, { status: 404 });
  if (!i.restaurant_id) return NextResponse.json({ statut: i.statut });
  const [r] = await requete<{ statut: string; total: number; prets: number; en_cours: boolean }>(
    `select r.statut,
            (select count(*)::int from plat pl where pl.restaurant_id = r.id and pl.actif) as total,
            (select count(*)::int from plat pl where pl.restaurant_id = r.id and pl.actif
                and exists (select 1 from accord a where a.plat_id = pl.id)) as prets,
            exists (select 1 from generation_accords g where g.restaurant_id = r.id and g.statut in ('en_attente', 'en_cours')) as en_cours
       from restaurant r where r.id = $1`, [i.restaurant_id]);
  if (!r) return NextResponse.json({ statut: i.statut });
  return NextResponse.json({
    statut: i.statut,
    restaurant: r.statut,
    preparation: {
      // « bloque » : génération terminée, relances automatiques comprises, mais des plats sans accord (Pat s'en occupe).
      statut: r.statut === 'en_service' ? 'fait' : r.en_cours ? 'en_cours' : r.prets < r.total ? 'bloque' : 'en_cours',
      total: r.total, faits: r.prets,
    },
  });
}
