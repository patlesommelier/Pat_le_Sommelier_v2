// Reprise de l'inscription quand le lien de confirmation n'a pas mené à /auth/inscription-confirmee
// (modèle d'e-mail Supabase par défaut, adresse de retour refusée, lien ouvert sur un autre appareil…).
// La confirmation est alors lue directement chez Supabase : écran d'attente, connexion, page d'accueil.
import 'server-only';
import { supabaseConfigure, supabaseService } from '../admin/supabase';
import { requete } from '../db';
import type { Inscription } from './etat';
import { FinalisationEnCours, finaliserInscription } from './finalisation';

/**
 * Inscription « compte créé » dont l'adresse a été confirmée chez Supabase : crée le restaurant.
 * Renvoie l'id du restaurant, ou null si l'adresse n'est pas encore confirmée (ou si un autre appel s'en occupe et que `attendre` est faux).
 */
export async function finaliserSiConfirme(i: Pick<Inscription, 'id' | 'statut' | 'user_id'>, { attendre = true } = {}): Promise<string | null> {
  if (i.statut !== 'compte_cree' || !i.user_id || !supabaseConfigure() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await supabaseService().auth.admin.getUserById(i.user_id);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at) return null;
  try {
    const { restaurantId } = await finaliserInscription(i.id, u.id, u.email.toLowerCase(), { attendre });
    return restaurantId;
  } catch (e) {
    if (e instanceof FinalisationEnCours) return null;
    throw e;
  }
}

/** Inscription en attente de ce compte (le plus récent), s'il y en a une. */
export async function inscriptionEnAttente(userId: string) {
  const [i] = await requete<Pick<Inscription, 'id' | 'statut' | 'user_id'>>(
    `select id, statut, user_id from inscription where user_id = $1 and statut = 'compte_cree' order by maj_le desc limit 1`, [userId]);
  return i ?? null;
}

/** À la connexion : un compte confirmé dont le restaurant n'a pas encore été créé le reçoit maintenant. */
export async function repriseALaConnexion(userId: string): Promise<string | null> {
  const i = await inscriptionEnAttente(userId);
  return i ? finaliserSiConfirme(i) : null;
}
