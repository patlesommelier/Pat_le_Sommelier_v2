import { NextResponse } from 'next/server';
import { supabaseSession } from '@/lib/admin/supabase';

/** Retour des liens envoyés par e-mail (mot de passe oublié) : ouvre la session puis redirige. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const suite = url.searchParams.get('suite') ?? '/admin';
  if (code) await (await supabaseSession()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(suite.startsWith('/admin') ? suite : '/admin', url.origin));
}
