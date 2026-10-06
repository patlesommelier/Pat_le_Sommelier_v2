// Avancement de la lecture de la carte et du menu, interrogé toutes les 3 secondes par le formulaire de la page d'accueil.
// Seulement des compteurs : { etape, carte: { statut, nombre }, menu: { statut, nombre } } — jamais les listes.
import { NextResponse } from 'next/server';
import { resumePublic } from '@/lib/inscription/etapes';
import { inscriptionCourante } from '@/lib/inscription/etat';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(resumePublic(await inscriptionCourante().then((i) => (i?.statut === 'en_cours' ? i : null))), { headers: { 'cache-control': 'no-store' } });
}
