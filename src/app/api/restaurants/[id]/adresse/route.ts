// Propositions d'adresses (OpenStreetMap) pour le champ « Adresse » des Paramètres du restaurant. Réservé à l'espace du restaurant.
import { NextResponse } from 'next/server';
import { exigerAcces } from '@/lib/admin/auth';
import { chercherAdresses, texteAdresse } from '@/lib/adresse/osm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigerAcces(id);
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const adresses = (await chercherAdresses(q)).map((a) => ({ ...a, texte: texteAdresse(a) }));
  return NextResponse.json(adresses, { headers: { 'cache-control': 'no-store' } });
}
