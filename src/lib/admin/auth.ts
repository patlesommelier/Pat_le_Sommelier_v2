import 'server-only';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { requete } from '../db';
import { supabaseConfigure, supabaseSession } from './supabase';

export interface Utilisateur {
  id: string; email: string; admin: boolean; restaurants: string[];
  /** Super-admin qui regarde l'espace comme ce restaurant (« Ouvrir en tant que… ») : droits du restaurant seulement. */
  vueRestaurant?: string;
}

/** Cookie « Ouvrir en tant que… » : ne peut que réduire les droits d'un super-admin, jamais en donner. */
export const COOKIE_VUE = 'pat_vue_restaurant';

const emailsAdmin = () =>
  (process.env.PAT_ADMIN_EMAILS ?? '').split(/[,;\s]+/).map((e) => e.replace(/["'<>]/g, '').trim().toLowerCase()).filter(Boolean);

/** Pour l'écran d'accueil : la variable des administrateurs est-elle lue par le serveur ? */
export const adminsConfigures = () => emailsAdmin().length;

/**
 * Mode développement sans Supabase : AUTH_DEV_EMAIL simule un administrateur connecté ;
 * avec AUTH_DEV_RESTAURANT=lola, un compte restaurant (pour vérifier ce qu'il voit).
 * Il n'est jamais actif sur Netlify ni dès que Supabase est configuré.
 */
function utilisateurDev(): Utilisateur | null {
  const email = process.env.AUTH_DEV_EMAIL;
  if (!email || supabaseConfigure() || process.env.NETLIFY) return null;
  const resto = process.env.AUTH_DEV_RESTAURANT;
  return { id: '00000000-0000-0000-0000-000000000000', email, admin: !resto, restaurants: resto ? [resto] : [] };
}

/** Utilisateur connecté tel qu'il est, sans le mode « Ouvrir en tant que… ». */
export const utilisateurReel = cache(async (): Promise<Utilisateur | null> => {
  const dev = utilisateurDev();
  if (dev) return dev;
  if (!supabaseConfigure()) return null;
  const supabase = await supabaseSession();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u?.email) return null;
  const email = u.email.toLowerCase();
  const acces = await requete<{ restaurant_id: string }>(
    'select restaurant_id from acces_restaurant where user_id = $1 or lower(email) = $2',
    [u.id, email],
  );
  return { id: u.id, email, admin: emailsAdmin().includes(email), restaurants: acces.map((a) => a.restaurant_id) };
});

/** Utilisateur des pages : un super-admin en mode « Ouvrir en tant que… » n'a que les droits de ce restaurant. */
export const utilisateurCourant = cache(async (): Promise<Utilisateur | null> => {
  const u = await utilisateurReel();
  if (!u?.admin) return u;
  const vue = (await cookies()).get(COOKIE_VUE)?.value;
  return vue ? { ...u, admin: false, restaurants: [vue], vueRestaurant: vue } : u;
});

/** Super-admin réel (même en mode « Ouvrir en tant que… ») : pour en sortir. */
export async function exigerSuperAdminReel() {
  const u = await utilisateurReel();
  if (!u?.admin) redirect('/admin');
  return u;
}

/** Page du back-office : il faut être connecté. */
export async function exigerConnexion() {
  const u = await utilisateurCourant();
  if (!u) redirect('/admin/connexion');
  return u;
}

/** Page ou action d'un restaurant : il faut y avoir accès (ou être administrateur). */
export async function exigerAcces(restaurantId: string) {
  const u = await exigerConnexion();
  if (!u.admin && !u.restaurants.includes(restaurantId)) redirect('/admin');
  return u;
}

export async function exigerAdmin() {
  const u = await exigerConnexion();
  if (!u.admin) redirect('/admin');
  return u;
}
