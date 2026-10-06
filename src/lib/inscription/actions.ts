'use server';
// Pat le sommelier — actions du formulaire de la page d'accueil (carte des vins, menu, restaurant).
// Chaque action relit l'inscription depuis le cookie : rien n'est confié au navigateur, qui ne reçoit que des compteurs.
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseConfigure, supabaseService, supabaseSession } from '@/lib/admin/supabase';
import { requete } from '@/lib/db';
import { traiterAnalyses } from './analyse';
import { resumePublic, type ResumePublic, type TypeAnalyse } from './etapes';
import { demarrerInscription, inscriptionCourante, lireInscription, majInscription, nettoyerInscriptions } from './etat';
import { typeReel, verifierFichiers } from './fichiers';
import { finaliserInscription } from './finalisation';
import { inscriptionAutorisee, MAX_ANALYSES_PAR_INSCRIPTION } from './limites';

export type Reponse = { erreurs: string[]; resume?: ResumePublic };

/** Espace du restaurant (tableau de bord), où le restaurateur arrive connecté à la fin du formulaire. */
const espace = (restaurantId: string | null) => (restaurantId ? `/admin/${restaurantId}` : '/admin');

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
  let i = await inscriptionCourante();
  if (!i) {
    await nettoyerInscriptions();
    if (!(await inscriptionAutorisee(await ip()))) return { erreurs: ['Trop d’inscriptions depuis cette connexion aujourd’hui. Réessayez demain ou contactez-nous.'] };
    i = await demarrerInscription();
  }
  if (i.statut !== 'en_cours') redirect(espace(i.restaurant_id));
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
  motDePasse: z.string().min(12, 'Mot de passe : 12 caractères minimum.').max(128),
  cgu: z.literal('on', { errorMap: () => ({ message: 'Acceptez les conditions d’utilisation.' }) }),
});

/** Mode de développement sans Supabase (jamais sur Netlify) : pas de compte réel, le back-office local est ouvert. */
const modeDev = () => !supabaseConfigure() && !process.env.NETLIFY;

/** « Créer mon sommelier » : compte (déjà confirmé), restaurant, session ouverte, préparation lancée, arrivée dans l'espace. */
export async function creerSommelier(_: Reponse, form: FormData): Promise<Reponse> {
  const i = await inscriptionCourante();
  if (!i) return { erreurs: ['Votre session a expiré : déposez à nouveau votre carte des vins.'] };
  if (i.statut === 'finalisee') redirect(`${espace(i.restaurant_id)}?bienvenue=1`);
  if (!i.vins.length || !i.plats.length) return { erreurs: ['Déposez d’abord votre carte des vins et votre menu.'] };
  const r = Compte.safeParse(Object.fromEntries(form));
  if (!r.success) return { erreurs: r.error.issues.map((x) => x.message) };

  // Accès immédiat (décision de Pat) : le compte est créé déjà confirmé. Les limites par connexion et par
  // inscription restent la protection contre les abus. Un double clic réutilise le compte déjà créé.
  let userId = i.user_id;
  if (!userId) {
    if (modeDev()) {
      userId = randomUUID();
    } else {
      const { data, error } = await supabaseService().auth.admin.createUser({ email: r.data.email, password: r.data.motDePasse, email_confirm: true });
      if (error || !data.user) {
        const deja = await lireInscription(i.id); // double clic : l'autre requête a peut-être déjà créé ce compte
        if (deja?.user_id && deja.email === r.data.email) userId = deja.user_id;
        else return { erreurs: [/registered|exists/i.test(error?.message ?? '') ? 'Un compte existe déjà avec cette adresse : connectez-vous.' : 'Création du compte impossible. Réessayez.'] };
      } else {
        userId = data.user.id;
      }
    }
    await majInscription(i.id, { user_id: userId, email: r.data.email, nom_restaurant: r.data.nom });
  } else {
    await majInscription(i.id, { nom_restaurant: r.data.nom });
  }

  let restaurantId: string;
  try {
    ({ restaurantId } = await finaliserInscription(i.id, userId!, r.data.email));
  } catch (e) {
    console.error('[inscription] création', i.id, e);
    return { erreurs: ['La création de votre espace n’a pas abouti. Réessayez dans un instant.'] };
  }
  if (!modeDev()) {
    const { error } = await (await supabaseSession()).auth.signInWithPassword({ email: r.data.email, password: r.data.motDePasse });
    if (error) redirect(`/admin/connexion?info=${encodeURIComponent('Votre espace est créé : connectez-vous avec votre e-mail.')}`);
  }
  redirect(`${espace(restaurantId)}?bienvenue=1`);
}

/** Avancement des lectures, interrogé par le formulaire pendant une lecture : seulement des compteurs. */
export async function etatInscription(): Promise<ResumePublic> {
  return resumePublic(await inscriptionCourante());
}
