'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requete } from '@/lib/db';
import { supabaseConfigure, supabaseService, supabaseSession } from '@/lib/admin/supabase';
import { exigerUtilisateurApp } from '@/lib/app/auth';
import { trouverAccords, type AccordReference } from '@/lib/app/recherche';

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const avec = (chemin: string, q: Record<string, string>) => `${chemin}?${new URLSearchParams(q)}`;
const origine = async () => { const h = await headers(); return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`; };

/** Nouveau compte (prénom, e-mail, mot de passe) : créé déjà confirmé, comme pour les restaurants, puis la session s'ouvre. */
export async function creerCompte(f: FormData) {
  const prenom = txt(f, 'prenom'), email = txt(f, 'email').toLowerCase(), mdp = String(f.get('mdp') ?? '');
  const retour = (erreur: string) => redirect(avec('/pat/inscription', { erreur, prenom, email }));
  if (!prenom) retour('Indique ton prénom.');
  if (!/^\S+@\S+\.\S+$/.test(email)) retour('Adresse e-mail invalide.');
  if (mdp.length < 10) retour('Le mot de passe doit faire au moins 10 caractères.');
  if (!supabaseConfigure()) redirect('/pat');
  const { data, error } = await supabaseService().auth.admin.createUser({ email, password: mdp, email_confirm: true, user_metadata: { prenom } });
  if (error || !data.user) retour(/registered|exists/i.test(error?.message ?? '') ? 'Un compte existe déjà avec cette adresse : connecte-toi.' : 'Création du compte impossible. Réessaie.');
  await requete(`insert into utilisateur_app (user_id, email, prenom, fournisseur) values ($1, $2, $3, 'email') on conflict (user_id) do update set prenom = excluded.prenom`,
    [data.user!.id, email, prenom]);
  await (await supabaseSession()).auth.signInWithPassword({ email, password: mdp });
  redirect('/pat');
}

export async function seConnecterApp(f: FormData) {
  if (!supabaseConfigure()) redirect('/pat');
  const email = txt(f, 'email');
  const { error } = await (await supabaseSession()).auth.signInWithPassword({ email, password: String(f.get('mdp') ?? '') });
  if (error) redirect(avec('/pat/connexion', { erreur: 'E-mail ou mot de passe incorrect.', email }));
  redirect('/pat');
}

/** Connexion avec Google ou Apple : Supabase renvoie vers le fournisseur, qui revient sur /pat/auth/retour. */
export async function connexionFournisseur(fournisseur: 'google' | 'apple') {
  if (!supabaseConfigure()) redirect('/pat');
  const { data, error } = await (await supabaseSession()).auth.signInWithOAuth({
    provider: fournisseur, options: { redirectTo: `${await origine()}/pat/auth/retour` },
  });
  if (error || !data.url) redirect(avec('/pat/connexion', { erreur: `La connexion avec ${fournisseur === 'google' ? 'Google' : 'Apple'} n’est pas encore disponible.` }));
  redirect(data.url!);
}

export async function motDePasseOublieApp(f: FormData) {
  if (supabaseConfigure()) {
    await (await supabaseSession()).auth.resetPasswordForEmail(txt(f, 'email'), { redirectTo: `${await origine()}/pat/auth/retour?suite=/pat/mot-de-passe` });
  }
  redirect(avec('/pat/connexion', { info: 'Si ce compte existe, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe.' }));
}

export async function changerMotDePasseApp(f: FormData) {
  const mdp = String(f.get('mdp') ?? '');
  if (mdp.length < 10) redirect(avec('/pat/mot-de-passe', { erreur: '10 caractères minimum.' }));
  const { error } = await (await supabaseSession()).auth.updateUser({ password: mdp });
  if (error) redirect(avec('/pat/mot-de-passe', { erreur: error.message }));
  redirect('/pat');
}

export async function seDeconnecterApp() {
  if (supabaseConfigure()) await (await supabaseSession()).auth.signOut();
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
