// Avancement de la dernière régénération des accords d'un restaurant (bloc en haut de la page Accords).
// Réservé au compte du restaurant et au super-admin ; seulement des compteurs.
import { NextResponse } from 'next/server';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { avancementAccords } from '@/lib/generation/file';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigerAcces(id);
  return NextResponse.json(await avancementAccords(requete, id), { headers: { 'cache-control': 'no-store' } });
}
