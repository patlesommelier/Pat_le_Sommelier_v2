'use server';
// Pat le sommelier — actions du formulaire de la page d'accueil : 1. restaurant (compte), 2. menu, 3. carte des vins, puis création.
// Chaque action relit l'inscription depuis le cookie : rien n'est confié au navigateur, qui ne reçoit que des compteurs.
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { z } from 'zod';
import { utilisateurReel } from '@/lib/admin/auth';
import { supabaseConfigure, supabaseService, supabaseSession } from '@/lib/admin/supabase';
import { requete } from '@/lib/db';
import { traiterAnalyses } from './analyse';
import { resumePublic, type ResumePublic, type TypeAnalyse } from './etapes';
import { demarrerInscription, inscriptionCourante, lireInscription, majInscription, nettoyerInscriptions } from './etat';
import { typeReel, verifierFichiers } from './fichiers';
import { finaliserInscription } from './finalisation';
import { inscriptionAutorisee, MAX_ANALYSES_PAR_INSCRIPTION } from './limites';

export type Reponse = { erreurs: string[]; resume?: ResumePublic; /** restaurant créé : la page suit la préparation des accords */ restaurantId?: string };

async function ip() {
  const h = await headers();
  return h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnue';
}

async function origine() {
  const h = await headers();
  return process.env.URL_PUBLIQUE?.replace(/\/$/, '') ?? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}

/** Lecture en arrière-plan : fonction Netlify (15 minutes) ; hors Netlify, le serveur la fait lui-même sans faire attendre. */
async function lancerLecture() {
  const statut = await fetch(`${await origine()}/.netlify/functions/analyser-inscription-background`, { method: 'POST' })
    .then((r) => r.status).catch(() => 0);
  if (statut !== 202 && statut !== 200) void traiterAnalyses(requete, { finAvant: Date.now() + 15 * 60 * 1000 }).catch((e) => console.error('[inscription]', e));
}

/** Dépôt de la carte des vins ou du menu : fichiers vérifiés et gardés dans la base, puis lecture en arrière-plan. */
export async function deposer(type: TypeAnalyse, _: Reponse, form: FormData): Promise<Reponse> {
  const i = await inscriptionCourante();
  if (!i || i.statut !== 'en_cours' || !i.user_id) return { erreurs: ['Votre session a expiré : indiquez à nouveau votre restaurant.'], resume: resumePublic(null) };
  if (i.analyses >= MAX_ANALYSES_PAR_INSCRIPTION) return { erreurs: ['Nombre maximal d’envois atteint. Contactez-nous pour continuer.'], resume: resumePublic(i) };

  const brut = form.getAll('fichiers').filter((f): f is File => f instanceof File && f.size > 0);
  const lus = await Promise.all(brut.map(async (f) => ({ nom: f.name.slice(0, 120), octets: new Uint8Array(await f.arrayBuffer()) })));
  const erreurs = verifierFichiers(type, lus);
  if (erreurs.length) return { erreurs, resume: resumePublic(i) };

  // « Remplacer » repart de zéro : anciens fichiers et ancien résultat de cette étape effacés.
  await requete('delete from inscription_fichier where inscription_id = $1 and type = $2', [i.id, type]);
  for (const f of lus) {
    await requete(`insert into inscription_fichier (inscription_id, type, nom, media_type, octets) values ($1, $2, $3, $4, $5)`,
      [i.id, type, f.nom, typeReel(f.octets), Buffer.from(f.octets)]); // type réel (signature binaire), pas celui du navigateur
  }
  const lecture = { ...i.lecture, [type]: { statut: 'en_attente' as const, lanceeLe: new Date().toISOString() } };
  await majInscription(i.id, { lecture, analyses: i.analyses + 1, ...(type === 'carte' ? { vins: [] } : { plats: [] }) });
  await lancerLecture();
  return { erreurs: [], resume: resumePublic(await lireInscription(i.id)) };
}

const Compte = z.object({
  nom: z.string().trim().min(2, 'Indiquez le nom du restaurant.').max(80),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  // 12 caractères minimum pour un nouveau compte (vérifié plus bas) ; un compte existant garde son mot de passe.
  motDePasse: z.string().min(1, 'Indiquez un mot de passe.').max(128),
  cgu: z.literal('on', { errorMap: () => ({ message: 'Acceptez les conditions d’utilisation.' }) }),
});

/** Un compte Supabase existe-t-il déjà pour cette adresse ? (table auth.users, lue avec la connexion du serveur) */
async function compteExiste(email: string) {
  try {
    const [r] = await requete<{ ok: boolean }>('select exists (select 1 from auth.users where lower(email) = $1) as ok', [email]);
    return Boolean(r?.ok);
  } catch {
    return false; // base sans schéma auth (développement local)
  }
}

/** Mode de développement sans Supabase (jamais sur Netlify) : pas de compte réel, le back-office local est ouvert. */
const modeDev = () => !supabaseConfigure() && !process.env.NETLIFY;

/**
 * Étape 1 : nom du restaurant, e-mail et mot de passe. Le compte est créé (déjà confirmé) et la session ouverte ;
 * le menu et la carte des vins viennent ensuite.
 */
export async function commencer(_: Reponse, form: FormData): Promise<Reponse> {
  const r = Compte.safeParse(Object.fromEntries(form));
  if (!r.success) return { erreurs: r.error.issues.map((x) => x.message) };
  let i = await inscriptionCourante();
  // Pas d'inscription en cours dans ce navigateur (ou la précédente est terminée) : une nouvelle commence.
  if (!i || i.statut !== 'en_cours') {
    await nettoyerInscriptions();
    // Pat (super-admin connecté) teste sans limite ; tout autre visiteur est limité par connexion et par jour.
    const admin = (await utilisateurReel().catch(() => null))?.admin;
    if (!admin && !(await inscriptionAutorisee(await ip()))) return { erreurs: ['Trop d’inscriptions depuis cette connexion aujourd’hui. Réessayez demain ou contactez-nous.'] };
    i = await demarrerInscription();
  }

  // Accès immédiat (décision de Pat) : le compte est créé déjà confirmé. Les limites par connexion et par
  // inscription restent la protection contre les abus. Un double clic réutilise le compte déjà créé.
  // Compte existant (deuxième restaurant, ou test de Pat) : le restaurant y sera ajouté, si l'on est déjà connecté
  // avec cette adresse dans ce navigateur, ou avec son mot de passe actuel.
  const email = r.data.email, motDePasse = r.data.motDePasse;
  const connecte = await utilisateurReel().catch(() => null);
  let sessionOuverte = Boolean(connecte && connecte.email === email);
  let userId: string;
  if (sessionOuverte) {
    userId = connecte!.id;
  } else if (modeDev()) {
    userId = i.user_id ?? randomUUID();
  } else {
    const MAUVAIS_MDP = `Un compte existe déjà pour ${email}, mais ce mot de passe ne correspond pas. Saisissez le mot de passe que vous utilisez pour vous connecter à votre espace (mot de passe oublié : bouton « Se connecter » en haut de la page), ou utilisez une autre adresse.`;
    const { data: existant, error: eConnexion } = await (await supabaseSession()).auth.signInWithPassword({ email, password: motDePasse });
    if (eConnexion && !/invalid login credentials/i.test(eConnexion.message)) console.warn('[inscription] connexion au compte existant :', eConnexion.message);
    const deja = await lireInscription(i.id); // double clic : l'autre requête a peut-être déjà créé le compte
    if (existant?.user) {
      userId = existant.user.id;
      sessionOuverte = true;
    } else if (deja?.user_id && deja.email === email) {
      userId = deja.user_id;
    } else if (await compteExiste(email)) {
      return { erreurs: [MAUVAIS_MDP] };
    } else {
      if (motDePasse.length < 12) return { erreurs: ['Nouveau compte : le mot de passe doit faire au moins 12 caractères.'] };
      const { data, error } = await supabaseService().auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
      if (error || !data.user) return { erreurs: [/registered|exists/i.test(error?.message ?? '') ? MAUVAIS_MDP : 'Création du compte impossible. Réessayez.'] };
      userId = data.user.id;
    }
  }
  await majInscription(i.id, { user_id: userId, email, nom_restaurant: r.data.nom });
  if (!modeDev() && !sessionOuverte) {
    const { error } = await (await supabaseSession()).auth.signInWithPassword({ email, password: motDePasse });
    if (error) console.warn('[inscription] ouverture de session :', error.message); // l'espace demandera de se connecter
  }
  return { erreurs: [], resume: resumePublic(await lireInscription(i.id)) };
}

/**
 * « Créer mon sommelier » (après la carte des vins) : restaurant créé et préparation des accords lancée.
 * La page d'inscription suit ensuite la préparation, puis affiche le QR code (voir Preparation.tsx).
 */
export async function creerSommelier(_: Reponse): Promise<Reponse> {
  const i = await inscriptionCourante();
  if (!i) return { erreurs: ['Votre session a expiré : recommencez l’inscription.'] };
  if (i.statut === 'finalisee' && i.restaurant_id) return { erreurs: [], restaurantId: i.restaurant_id };
  if (!i.user_id || !i.email) return { erreurs: ['Indiquez d’abord votre restaurant et votre e-mail.'] };
  if (!i.vins.length || !i.plats.length) return { erreurs: ['Déposez d’abord votre menu et votre carte des vins.'] };
  let restaurantId: string;
  try {
    ({ restaurantId } = await finaliserInscription(i.id, i.user_id, i.email));
  } catch (e) {
    console.error('[inscription] création', i.id, e);
    return { erreurs: ['La création de votre espace n’a pas abouti. Réessayez dans un instant.'] };
  }
  return { erreurs: [], restaurantId };
}

/** Avancement des lectures, interrogé par le formulaire pendant une lecture : seulement des compteurs. */
export async function etatInscription(): Promise<ResumePublic> {
  return resumePublic(await inscriptionEnCours());
}

/** Inscription en cours dans ce navigateur (une inscription terminée laisse place à un formulaire vierge). */
async function inscriptionEnCours() {
  const i = await inscriptionCourante();
  return i?.statut === 'en_cours' ? i : null;
}
