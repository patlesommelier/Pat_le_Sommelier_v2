// Avancement de la préparation des accords d'un restaurant (bloc « Bienvenue » du tableau de bord).
// Réservé au compte du restaurant et au super-admin ; seulement des compteurs.
import { NextResponse } from 'next/server';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigerAcces(id);
  const [r] = await requete<{ statut: string; total: number; prets: number; en_cours: boolean }>(
    `select r.statut,
            (select count(*)::int from plat pl where pl.restaurant_id = r.id and pl.actif) as total,
            (select count(*)::int from plat pl where pl.restaurant_id = r.id and pl.actif
                and exists (select 1 from accord a where a.plat_id = pl.id)) as prets,
            exists (select 1 from generation_accords g where g.restaurant_id = r.id and g.statut in ('en_attente', 'en_cours')) as en_cours
       from restaurant r where r.id = $1`, [id]);
  if (!r) return NextResponse.json({ erreur: 'introuvable' }, { status: 404 });
  return NextResponse.json({
    restaurant: r.statut,
    // « bloque » : génération terminée (relances automatiques comprises) mais des plats sans accord : Pat s'en occupe.
    preparation: { statut: r.statut === 'en_service' ? 'fait' : r.en_cours ? 'en_cours' : r.prets < r.total ? 'bloque' : 'en_cours', total: r.total, faits: r.prets },
  }, { headers: { 'cache-control': 'no-store' } });
}
