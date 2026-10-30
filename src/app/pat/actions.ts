'use server';
import { redirect } from 'next/navigation';
import { requete } from '@/lib/db';
import { creerCompte, definirMotDePasse, fermerSession, MDP_MINIMUM, motDePasseOublie, ouvrirSession, verifierIdentifiants } from '@/lib/comptes/comptes';
import { exigerUtilisateurApp } from '@/lib/app/auth';
import { trouverAccords, type AccordReference } from '@/lib/app/recherche';

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const avec = (chemin: string, q: Record<string, string>) => `${chemin}?${new URLSearchParams(q)}`;

/** Nouveau compte (prénom, e-mail, mot de passe) : prêt tout de suite, la session s'ouvre. */
export async function creerCompteApp(f: FormData) {
  const prenom = txt(f, 'prenom'), email = txt(f, 'email').toLowerCase(), mdp = String(f.get('mdp') ?? '');
  const retour = (erreur: string) => redirect(avec('/pat/inscription', { erreur, prenom, email }));
  if (!prenom) retour('Indique ton prénom.');
  if (!/^\S+@\S+\.\S+$/.test(email)) retour('Adresse e-mail invalide.');
  if (mdp.length < MDP_MINIMUM) retour(`Le mot de passe doit faire au moins ${MDP_MINIMUM} caractères.`);
  // Une adresse déjà connue (compte d'un restaurant, même invité sans mot de passe) ne se reprend jamais ici.
  const { id, existait } = await creerCompte(email, mdp);
  if (existait) retour('Un compte existe déjà avec cette adresse : connecte-toi (ou « Mot de passe oublié »).');
  await requete(`insert into utilisateur_app (user_id, email, prenom, fournisseur) values ($1, $2, $3, 'email') on conflict (user_id) do update set prenom = excluded.prenom`,
    [id, email, prenom]);
  await ouvrirSession(id);
  redirect('/pat');
}

export async function seConnecterApp(f: FormData) {
  const email = txt(f, 'email');
  const id = await verifierIdentifiants(email, String(f.get('mdp') ?? ''));
  if (!id) redirect(avec('/pat/connexion', { erreur: 'E-mail ou mot de passe incorrect.', email }));
  await ouvrirSession(id!);
  redirect('/pat');
}

export async function motDePasseOublieApp(f: FormData) {
  const actif = await motDePasseOublie(txt(f, 'email'), '/pat/mot-de-passe');
  redirect(avec('/pat/connexion', actif ? { info: 'Si ce compte existe, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe.' }
    : { erreur: 'Le changement de mot de passe par e-mail n’est pas encore disponible.', oubli: '1' }));
}

export async function changerMotDePasseApp(f: FormData) {
  const u = await exigerUtilisateurApp();
  const mdp = String(f.get('mdp') ?? '');
  if (mdp.length < MDP_MINIMUM) redirect(avec('/pat/mot-de-passe', { erreur: `${MDP_MINIMUM} caractères minimum.` }));
  await definirMotDePasse(u.id, mdp);
  redirect('/pat');
}

export async function seDeconnecterApp() {
  await fermerSession();
  redirect('/pat/connexion');
}

/** Ce que l'utilisateur demande à Pat : les accords de référence les plus proches de sa question. */
export async function demanderAPat(question: string): Promise<AccordReference[]> {
  await exigerUtilisateurApp();
  const accords = await requete<AccordReference>(
    `select id, nom, famille, sous_famille, variantes, vins_recommandes, producteurs_phares, alternative_accessible,
            justification_charnelle, notes_pratiques, axe_diversite_2, axe_diversite_3
       from accord_reference where actif`);
  return trouverAccords(question.slice(0, 500), accords);
}
