import { NextResponse } from 'next/server';
import { adresseSite, compteDuLien, ouvrirSession } from '@/lib/comptes/comptes';

/** Lien reçu par e-mail (invitation, mot de passe oublié) : la session s'ouvre, puis la personne choisit son mot de passe. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const brute = url.searchParams.get('suite') ?? '/admin/mot-de-passe';
  const suite = /^\/(admin|pat)(\/|$)/.test(brute) ? brute : '/admin/mot-de-passe';
  const site = await adresseSite(suite);
  const compte = await compteDuLien(url.searchParams.get('jeton') ?? '');
  if (!compte) {
    const app = suite.startsWith('/pat');
    const erreur = 'Ce lien a expiré ou a déjà servi : demandez-en un nouveau (« Mot de passe oublié »).';
    return NextResponse.redirect(new URL(`${app ? '/pat/connexion' : '/admin/connexion'}?${new URLSearchParams({ erreur })}`, site));
  }
  await ouvrirSession(compte);
  return NextResponse.redirect(new URL(suite, site));
}
