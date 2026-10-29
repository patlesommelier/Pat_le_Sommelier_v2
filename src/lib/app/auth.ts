import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { requete } from '../db';
import { supabaseConfigure, supabaseSession } from '../admin/supabase';
import { enProduction } from '../production';

/** Utilisateur de l'App consommateur (/pat) : un compte Supabase Auth, comme ceux des restaurants, et son profil. */
export interface UtilisateurApp { id: string; email: string; prenom: string | null; fournisseur: string }

/** Prénom donné par Google ou Apple (métadonnées du compte), sinon null. */
function prenomFournisseur(meta: Record<string, unknown> | undefined) {
  const v = (meta?.given_name ?? meta?.first_name ?? String(meta?.full_name ?? meta?.name ?? '').split(' ')[0]) as string | undefined;
  return v?.trim() || null;
}

/**
 * Utilisateur connecté à l'App, avec son profil (créé à sa première visite : compte Google ou Apple, ou compte d'un restaurant).
 * Sans Supabase, en développement, AUTH_DEV_EMAIL simule un utilisateur connecté.
 */
export const utilisateurApp = cache(async (): Promise<UtilisateurApp | null> => {
  let id: string, email: string, fournisseur = 'email', prenom: string | null = null;
  if (!supabaseConfigure()) {
    const dev = enProduction() ? null : process.env.AUTH_DEV_EMAIL;
    if (!dev) return null;
    [id, email] = ['00000000-0000-0000-0000-000000000000', dev];
  } else {
    const { data } = await (await supabaseSession()).auth.getUser();
    const u = data.user;
    if (!u?.email) return null;
    [id, email] = [u.id, u.email.toLowerCase()];
    fournisseur = String(u.app_metadata?.provider ?? 'email');
    prenom = (u.user_metadata?.prenom as string | undefined) ?? prenomFournisseur(u.user_metadata);
  }
  const [p] = await requete<UtilisateurApp>(
    `insert into utilisateur_app (user_id, email, prenom, fournisseur) values ($1, $2, $3, $4)
     on conflict (user_id) do update set email = excluded.email, prenom = coalesce(utilisateur_app.prenom, excluded.prenom),
       derniere_connexion = case when utilisateur_app.derniere_connexion < now() - interval '1 hour' then now() else utilisateur_app.derniere_connexion end
     returning user_id as id, email, prenom, fournisseur`, [id, email, prenom, fournisseur]);
  return p;
});

/** Page de l'App réservée aux utilisateurs connectés. */
export async function exigerUtilisateurApp() {
  const u = await utilisateurApp();
  if (!u) redirect('/pat/connexion');
  return u;
}
