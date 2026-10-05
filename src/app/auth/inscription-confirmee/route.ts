// Lien de l'e-mail de confirmation → session ouverte, restaurant créé, préparation des accords lancée.
//
// Modèle d'e-mail Supabase « Confirm signup » (Authentication → Email Templates) :
//   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirmer mon adresse</a>
// {{ .RedirectTo }} vaut …/auth/inscription-confirmee?i=<id de l'inscription> (posé à la création du compte).
// Le lien peut être ouvert sur un autre appareil : un nouveau cookie d'inscription y est posé.
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfigure, supabaseSession } from '@/lib/admin/supabase';
import { requete } from '@/lib/db';
import { lireInscription } from '@/lib/inscription/etat';
import { finaliserInscription } from '@/lib/inscription/finalisation';
import { COOKIE, nouveauJeton, optionsCookie } from '@/lib/inscription/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const inscriptionId = url.searchParams.get('i') ?? '';
  const vers = (chemin: string) => NextResponse.redirect(new URL(chemin, url.origin));
  if (!/^[0-9a-f-]{36}$/i.test(inscriptionId)) return vers('/inscription?erreur=lien');

  let userId: string, email: string;
  if (!supabaseConfigure() && !process.env.NETLIFY && url.searchParams.get('dev') === '1') {
    // Développement local sans Supabase : pas d'e-mail, le compte de l'inscription est considéré confirmé.
    const i = await lireInscription(inscriptionId);
    if (!i?.user_id || !i.email) return vers('/inscription?erreur=lien');
    [userId, email] = [i.user_id, i.email];
  } else {
    const tokenHash = url.searchParams.get('token_hash');
    if (!tokenHash || !supabaseConfigure()) return vers('/inscription?erreur=lien');
    const { data, error } = await (await supabaseSession()).auth.verifyOtp({ type: 'email', token_hash: tokenHash });
    if (error || !data.user?.email) return vers('/inscription?erreur=lien-expire');
    [userId, email] = [data.user.id, data.user.email.toLowerCase()];
  }

  try {
    await finaliserInscription(inscriptionId, userId, email);
  } catch (e) {
    console.error('Finalisation de l’inscription', inscriptionId, e);
    return vers('/inscription?erreur=finalisation');
  }
  // Ce navigateur (peut-être un autre que celui de l'inscription) reçoit un nouveau cookie : l'écran du QR code s'y affiche.
  const { jeton, empreinte } = nouveauJeton();
  await requete('update inscription set jeton_empreinte = $2, expire_le = greatest(expire_le, now() + interval \'2 days\') where id = $1 and user_id = $3',
    [inscriptionId, empreinte, userId]);
  (await cookies()).set(COOKIE, jeton, optionsCookie);
  return vers('/inscription/qr');
}
