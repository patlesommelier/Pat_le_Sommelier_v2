import 'server-only';
// Comptes de Pat le sommelier (restaurants, Pat, App client) : e-mail et mot de passe, session dans un cookie,
// liens envoyés par e-mail (invitation, mot de passe oublié). Remplace Supabase Auth.
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { requete } from '../db';
import { envoiEmailConfigure, envoyerEmail } from '../email';
import { enProduction } from '../production';
import { empreinteJeton, hacherMotDePasse, nouveauJeton, verifierMotDePasse } from './secret';

export const COOKIE_SESSION = 'pat_session';
const DUREE_SESSION_JOURS = 60;
export const MDP_MINIMUM = 10;

export interface Compte { id: string; email: string; aMotDePasse: boolean }

const normaliser = (email: string) => email.trim().toLowerCase();

/** Adresse du site pour les liens envoyés par e-mail : URL_PUBLIQUE (jamais l'en-tête Host, qu'un tiers peut choisir). */
export async function adresseSite() {
  const fixe = process.env.URL_PUBLIQUE?.trim().replace(/\/$/, '');
  if (fixe) return fixe;
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}

export async function trouverCompte(email: string): Promise<Compte | null> {
  const [c] = await requete<Compte>(
    'select id, email, mot_de_passe is not null as "aMotDePasse" from compte where lower(email) = $1', [normaliser(email)]);
  return c ?? null;
}

/**
 * Crée le compte (sans mot de passe : la personne le choisira avec un lien), ou renvoie celui qui existe déjà.
 * Les accès de restaurant donnés à cette adresse avant le compte lui sont rattachés.
 */
export async function creerCompte(email: string, motDePasse: string | null = null): Promise<{ id: string; existait: boolean }> {
  const e = normaliser(email);
  const empreinte = motDePasse ? await hacherMotDePasse(motDePasse) : null;
  const [nouveau] = await requete<{ id: string }>(
    'insert into compte (email, mot_de_passe) values ($1, $2) on conflict (lower(email)) do nothing returning id', [e, empreinte]);
  const id = nouveau?.id ?? (await trouverCompte(e))!.id;
  await requete(
    `update acces_restaurant a set user_id = $1 where lower(a.email) = $2 and a.user_id <> $1
        and not exists (select 1 from acces_restaurant b where b.user_id = $1 and b.restaurant_id = a.restaurant_id)`, [id, e]);
  return { id, existait: !nouveau };
}

// Trop d'essais de mot de passe pour une même adresse : une pause de 15 minutes (mémoire du serveur).
const echecs = new Map<string, { n: number; depuis: number }>();
const bloque = (e: string) => { const x = echecs.get(e); return Boolean(x && x.n >= 10 && Date.now() - x.depuis < 15 * 60_000); };
function noterEchec(e: string) {
  const x = echecs.get(e);
  echecs.set(e, x && Date.now() - x.depuis < 15 * 60_000 ? { n: x.n + 1, depuis: x.depuis } : { n: 1, depuis: Date.now() });
  if (echecs.size > 5000) echecs.clear();
}

/** Identifiant du compte si l'e-mail et le mot de passe correspondent, sinon null. */
export async function verifierIdentifiants(email: string, motDePasse: string): Promise<string | null> {
  const e = normaliser(email);
  if (!e || !motDePasse || bloque(e)) return null;
  const [c] = await requete<{ id: string; mot_de_passe: string | null }>('select id, mot_de_passe from compte where lower(email) = $1', [e]);
  if (c?.mot_de_passe && await verifierMotDePasse(motDePasse, c.mot_de_passe)) { echecs.delete(e); return c.id; }
  noterEchec(e);
  return null;
}

/** Nouveau mot de passe : les liens envoyés par e-mail ne servent plus, les autres sessions sont fermées. */
export async function definirMotDePasse(compteId: string, motDePasse: string) {
  await requete('update compte set mot_de_passe = $2 where id = $1', [compteId, await hacherMotDePasse(motDePasse)]);
  await requete('delete from lien_compte where compte_id = $1', [compteId]);
  const actuelle = (await cookies()).get(COOKIE_SESSION)?.value;
  await requete('delete from session_compte where compte_id = $1 and jeton <> $2', [compteId, actuelle ? empreinteJeton(actuelle) : '']);
}

// ───────── Session (cookie) ─────────
export async function ouvrirSession(compteId: string) {
  const jeton = nouveauJeton();
  await requete(`insert into session_compte (jeton, compte_id, expire_le) values ($1, $2, now() + make_interval(days => $3))`,
    [empreinteJeton(jeton), compteId, DUREE_SESSION_JOURS]);
  await requete('update compte set derniere_connexion = now() where id = $1', [compteId]);
  await requete('delete from session_compte where expire_le < now()');
  (await cookies()).set(COOKIE_SESSION, jeton, {
    httpOnly: true, secure: enProduction(), sameSite: 'lax', path: '/', maxAge: DUREE_SESSION_JOURS * 24 * 3600,
  });
}

export async function fermerSession() {
  const store = await cookies();
  const jeton = store.get(COOKIE_SESSION)?.value;
  if (jeton) await requete('delete from session_compte where jeton = $1', [empreinteJeton(jeton)]);
  store.delete(COOKIE_SESSION);
}

/** Compte connecté dans ce navigateur (cookie de session valide), ou null. */
export const compteConnecte = cache(async (): Promise<Compte | null> => {
  const jeton = (await cookies()).get(COOKIE_SESSION)?.value;
  if (!jeton) return null;
  const [c] = await requete<Compte>(
    `select c.id, c.email, c.mot_de_passe is not null as "aMotDePasse" from session_compte s join compte c on c.id = s.compte_id
      where s.jeton = $1 and s.expire_le > now()`, [empreinteJeton(jeton)]);
  return c ?? null;
});

// ───────── Liens envoyés par e-mail ─────────
/**
 * Lien qui ouvre la session puis mène à `suite` (choisir son mot de passe). Il resservira jusqu'à sa date
 * (les logiciels de messagerie ouvrent parfois les liens avant la personne) et ne vaut plus rien dès que le mot de passe change.
 */
export async function creerLien(compteId: string, suite: string, jours: number) {
  const jeton = nouveauJeton();
  await requete(`insert into lien_compte (jeton, compte_id, expire_le) values ($1, $2, now() + make_interval(days => $3))`,
    [empreinteJeton(jeton), compteId, jours]);
  await requete('delete from lien_compte where expire_le < now()');
  return `${await adresseSite()}/connexion/lien?${new URLSearchParams({ jeton, suite })}`;
}

/** Compte du lien s'il est encore valable, sinon null. */
export async function compteDuLien(jeton: string): Promise<string | null> {
  const [l] = await requete<{ compte_id: string }>('select compte_id from lien_compte where jeton = $1 and expire_le > now()', [empreinteJeton(jeton)]);
  return l?.compte_id ?? null;
}

/**
 * Envoie le lien par e-mail. Sans service d'envoi configuré (Resend), renvoie le lien pour le transmettre soi-même
 * (invitations) ; `envoye` dit si l'e-mail est parti.
 */
export async function envoyerLien(email: string, lien: string, sujet: string, texte: string): Promise<{ envoye: boolean; erreur?: string }> {
  if (!envoiEmailConfigure()) return { envoye: false };
  const erreur = await envoyerEmail({ a: email, sujet, texte: `${texte}\n\n${lien}\n\nPat le sommelier` });
  return erreur ? { envoye: false, erreur } : { envoye: true };
}

/** Invitation : un lien (7 jours) pour choisir son mot de passe, envoyé par e-mail (ou à transmettre soi-même : `lien`). */
export async function inviter(compteId: string, email: string) {
  const lien = await creerLien(compteId, '/admin/mot-de-passe', 7);
  const r = await envoyerLien(email, lien, 'Votre accès à Pat le sommelier',
    'Bonjour,\n\nUn accès à l’espace restaurant de Pat le sommelier a été créé pour vous. Pour choisir votre mot de passe, ouvrez ce lien (valable 7 jours) :');
  return { ...r, lien };
}

/**
 * « Mot de passe oublié » : un lien (24 heures) part si le compte existe. Avec `creerSiConnu`, un compte est d'abord créé
 * pour une adresse qui a déjà un accès (restaurant, ou Pat) mais pas encore de compte : anciens comptes Supabase.
 * Ne dit jamais si l'adresse est connue. Renvoie false si l'envoi d'e-mails n'est pas activé.
 */
export async function motDePasseOublie(email: string, suite: string, creerSiConnu: (email: string) => Promise<boolean> = async () => false) {
  const e = normaliser(email);
  if (!envoiEmailConfigure()) return false;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return true;
  const id = (await trouverCompte(e))?.id ?? (await creerSiConnu(e) ? (await creerCompte(e)).id : null);
  if (id) {
    await envoyerLien(e, await creerLien(id, suite, 1), 'Pat le sommelier : choisir un nouveau mot de passe',
      'Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 24 heures) :');
  }
  return true;
}
