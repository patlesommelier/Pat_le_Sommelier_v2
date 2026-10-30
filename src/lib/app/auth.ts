import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { requete } from '../db';
import { compteConnecte } from '../comptes/comptes';
import { enProduction } from '../production';

/** Utilisateur de l'App consommateur (/pat) : un compte, comme ceux des restaurants, et son profil. */
export interface UtilisateurApp { id: string; email: string; prenom: string | null; fournisseur: string }

/**
 * Utilisateur connecté à l'App, avec son profil (créé à sa première visite pour un compte d'un restaurant).
 * En développement, AUTH_DEV_EMAIL simule un utilisateur connecté.
 */
export const utilisateurApp = cache(async (): Promise<UtilisateurApp | null> => {
  let id: string, email: string;
  const fournisseur = 'email', prenom: string | null = null;
  const u = await compteConnecte();
  if (u) [id, email] = [u.id, u.email.toLowerCase()];
  else {
    const dev = enProduction() ? null : process.env.AUTH_DEV_EMAIL;
    if (!dev) return null;
    [id, email] = ['00000000-0000-0000-0000-000000000000', dev];
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
