import { NextResponse } from 'next/server';
import { supabaseSession } from '@/lib/admin/supabase';

/** Retour de Google ou d'Apple (ou d'un lien « mot de passe oublié ») : la session s'ouvre, puis l'utilisateur arrive chez Pat. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (code) {
    const { error } = await (await supabaseSession()).auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/pat/connexion?erreur=Connexion%20impossible.%20R%C3%A9essaie.', url.origin));
  }
  const suite = url.searchParams.get('suite') ?? '/pat';
  return NextResponse.redirect(new URL(suite.startsWith('/pat') ? suite : '/pat', url.origin));
}
