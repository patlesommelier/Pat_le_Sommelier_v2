import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseSession } from '@/lib/admin/supabase';

/**
 * Retour des liens envoyés par e-mail (invitation, mot de passe oublié) : ouvre la session puis redirige vers `suite`.
 * Trois formes de lien selon Supabase : ?code= (PKCE), ?token_hash=&type= (modèle d'e-mail), ou les jetons dans le
 * fragment de l'adresse (#access_token=…, invitations envoyées par le serveur) — ceux-là, seul le navigateur les lit : /admin/auth/lien.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const suite = (url.searchParams.get('suite') ?? '/admin').startsWith('/admin') ? url.searchParams.get('suite') ?? '/admin' : '/admin';
  const erreur = () => NextResponse.redirect(new URL('/admin/connexion?erreur=Ce%20lien%20a%20expir%C3%A9%20ou%20a%20d%C3%A9j%C3%A0%20servi%20%3A%20demandez-en%20un%20nouveau%20(%C2%AB%20Mot%20de%20passe%20oubli%C3%A9%20%C2%BB).', url.origin));
  if (code) {
    const { error } = await (await supabaseSession()).auth.exchangeCodeForSession(code);
    return error ? erreur() : NextResponse.redirect(new URL(suite, url.origin));
  }
  if (tokenHash && type) {
    const { error } = await (await supabaseSession()).auth.verifyOtp({ token_hash: tokenHash, type });
    return error ? erreur() : NextResponse.redirect(new URL(suite, url.origin));
  }
  // Jetons dans le fragment (#…) : le navigateur les garde à travers cette redirection.
  return NextResponse.redirect(new URL(`/admin/auth/lien?suite=${encodeURIComponent(suite)}`, url.origin));
}
