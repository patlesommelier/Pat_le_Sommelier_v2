// Lecture et écriture de l'inscription en cours (côté serveur, via le jeton du cookie).
import 'server-only';
import { cookies } from 'next/headers';
import { requete } from '../db';
import { COOKIE, empreinte, expireLe, nouveauJeton, optionsCookie } from './session';
import type { Plat, VinRapproche } from './donnees';
import type { Analyses } from './etapes';

export type Inscription = {
  id: string;
  statut: 'en_cours' | 'compte_cree' | 'finalisee' | 'expiree';
  plats: Plat[];
  vins: VinRapproche[];
  logo_fichier: string | null;
  couleur: string | null;
  couleurs_proposees: Array<{ hex: string; nom: string; duLogo: boolean }>;
  logo_clair: boolean | null;
  analyses: number;
  /** État des lectures en arrière-plan (carte, menu) : compteurs seulement. */
  lecture: Analyses;
  nom_restaurant: string | null;
  ville: string | null;
  email: string | null;
  user_id: string | null;
  restaurant_id: string | null;
  expire_le: string;
};

const COLONNES = `id, statut, plats, vins, logo_fichier, couleur, couleurs_proposees, logo_clair, analyses, lecture, nom_restaurant, ville, email,
  user_id, restaurant_id, expire_le`;

/** Premier onglet rempli, mais menu pas déposé dans ce délai : l'inscription est réinitialisée. */
export const DELAI_MENU_SECONDES = 60;

export async function inscriptionCourante(): Promise<Inscription | null> {
  const jeton = (await cookies()).get(COOKIE)?.value;
  if (!jeton) return null;
  await requete(
    `update inscription set statut = 'expiree', maj_le = now()
      where (jeton_empreinte = $1 or $1 = any(jetons_autres)) and statut = 'en_cours' and user_id is not null
        and lecture->'menu' is null and jsonb_array_length(plats) = 0 and maj_le < now() - make_interval(secs => $2)`,
    [empreinte(jeton), DELAI_MENU_SECONDES]);
  const [i] = await requete<Inscription>(`select ${COLONNES} from inscription where (jeton_empreinte = $1 or $1 = any(jetons_autres)) and expire_le > now() and statut <> 'expiree'`, [empreinte(jeton)]);
  return i ?? null;
}

export async function lireInscription(id: string): Promise<Inscription | null> {
  const [i] = await requete<Inscription>(`select ${COLONNES} from inscription where id = $1`, [id]);
  return i ?? null;
}

/** Démarre une inscription (premier dépôt de fichiers sur la page d'accueil) et pose le cookie. */
export async function demarrerInscription(): Promise<Inscription> {
  const { jeton, empreinte: emp } = nouveauJeton();
  const [i] = await requete<Inscription>(`insert into inscription (jeton_empreinte, expire_le) values ($1, $2) returning ${COLONNES}`,
    [emp, expireLe().toISOString()]);
  (await cookies()).set(COOKIE, jeton, optionsCookie);
  return i;
}

const JSONB = new Set(['plats', 'vins', 'couleurs_proposees', 'lecture']);
const MODIFIABLES = new Set(['statut', 'plats', 'vins', 'logo_fichier', 'couleur', 'couleurs_proposees', 'logo_clair', 'analyses', 'lecture',
  'nom_restaurant', 'ville', 'email', 'user_id', 'restaurant_id']);

export async function majInscription(id: string, champs: Partial<Inscription>) {
  const cles = Object.keys(champs).filter((k) => MODIFIABLES.has(k));
  if (!cles.length) return;
  const valeurs = cles.map((k) => (JSONB.has(k) ? JSON.stringify(champs[k as keyof Inscription]) : champs[k as keyof Inscription]));
  await requete(`update inscription set ${cles.map((k, n) => `${k} = $${n + 2}`).join(', ')}, maj_le = now() where id = $1`, [id, ...valeurs]);
}

/** Inscriptions abandonnées (et leurs fichiers) : effacées une semaine après leur expiration. */
export async function nettoyerInscriptions() {
  await requete(`delete from inscription where statut <> 'finalisee' and expire_le < now() - interval '7 days'`);
  await requete(`delete from inscription_fichier f using inscription i where i.id = f.inscription_id and i.statut = 'finalisee' and i.maj_le < now() - interval '1 day'`);
  await requete(`delete from inscription_tentative where cree_le < now() - interval '2 days'`);
}
