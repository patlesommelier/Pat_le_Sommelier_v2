// Session reçue dans le fragment du lien de confirmation : vérifiée chez Supabase, puis restaurant créé.
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfigure, supabaseService, supabaseSession } from '@/lib/admin/supabase';
import { requete } from '@/lib/db';
import { lireInscription, ouvrirSurCeNavigateur } from '@/lib/inscription/etat';
import { finaliserSiConfirme, inscriptionEnAttente } from '@/lib/inscription/reprise';

export const dynamic = 'force-dynamic';

const connexion = (info: string) => NextResponse.json({ vers: `/admin/connexion?info=${encodeURIComponent(info)}` });

export async function POST(req: NextRequest) {
  if (!supabaseConfigure()) return NextResponse.json({ vers: '/admin/connexion' });
  const corps = await req.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; inscription?: string };
  const idInscription = typeof corps.inscription === 'string' && /^[0-9a-f-]{36}$/i.test(corps.inscription) ? corps.inscription : null;

  // Sans session dans le lien : l'adresse a peut-être été confirmée quand même ; le restaurant est créé, puis connexion.
  if (!corps.access_token) {
    const i = idInscription ? await lireInscription(idInscription) : null;
    if (i?.statut === 'compte_cree') await finaliserSiConfirme(i).catch((e) => console.error('[inscription] confirmation', e));
    return connexion('Adresse confirmée. Connectez-vous pour accéder à votre espace.');
  }

  const { data } = await supabaseService().auth.getUser(corps.access_token);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at) return connexion('Lien invalide ou expiré. Connectez-vous.');
  // Session ouverte dans ce navigateur : « Accéder à mon espace » fonctionne sans se reconnecter.
  if (corps.refresh_token) await (await supabaseSession()).auth.setSession({ access_token: corps.access_token, refresh_token: corps.refresh_token }).catch(() => null);

  const enAttente = await inscriptionEnAttente(u.id);
  const [derniere] = enAttente ? [enAttente] : await requete<{ id: string; statut: string; user_id: string }>(
    `select id, statut, user_id from inscription where user_id = $1 and statut = 'finalisee' order by maj_le desc limit 1`, [u.id]);
  if (!derniere) return NextResponse.json({ vers: '/admin' }); // compte sans inscription (invitation, mot de passe…)
  try {
    if (derniere.statut === 'compte_cree') await finaliserSiConfirme(derniere as Parameters<typeof finaliserSiConfirme>[0]);
  } catch (e) {
    console.error('[inscription] confirmation', e);
    return NextResponse.json({ vers: '/inscription?erreur=finalisation' });
  }
  // Ce navigateur reçoit le cookie de l'inscription : l'écran du QR code s'y affiche.
  await ouvrirSurCeNavigateur(derniere.id, u.id);
  return NextResponse.json({ vers: '/inscription/qr' });
}
