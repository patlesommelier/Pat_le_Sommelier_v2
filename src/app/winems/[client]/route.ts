// QR code du frigo connecté (WineMS) : WineMS renvoie ici avec le numéro de son client ; on ouvre l'app du restaurant
// relié à ce client (Pat le Sommelier). Client inconnu : l'accueil du site.
import { NextResponse } from 'next/server';
import { requete } from '@/lib/db';
import { adresseSite } from '@/lib/comptes/comptes';

export async function GET(_req: Request, { params }: { params: Promise<{ client: string }> }) {
  const { client } = await params;
  const [r] = await requete<{ id: string }>('select id from restaurant where winems_client_id = $1 limit 1', [client]);
  const chemin = r ? `/${r.id}` : '/';
  return NextResponse.redirect(new URL(chemin, await adresseSite(chemin)), 302);
}
