'use server';
// Pat le sommelier — actions serveur du parcours d'inscription.
// Chaque étape relit l'inscription depuis le cookie : rien n'est confié au navigateur.
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseConfigure, supabaseService } from '@/lib/admin/supabase';
import { requete } from '@/lib/db';
import { analyserCarte, analyserMenu, rapprocherVins, type FichierEnvoye } from '@/lib/inscription/adaptateurs';
import { couleursDuLogo, logoEstClair } from '@/lib/inscription/couleurs-image';
import { depuisHex, lisibleAvecBlanc } from '@/lib/inscription/couleurs';
import { dedoublonnerPlats, dedoublonnerVins, Plat, validerListe, Vin } from '@/lib/inscription/donnees';
import { demarrerInscription, inscriptionCourante, majInscription, nettoyerInscriptions, type Inscription } from '@/lib/inscription/etat';
import { typeReel, verifierFichiers, type TypeEnvoi } from '@/lib/inscription/fichiers';
import { inscriptionAutorisee, MAX_ANALYSES_PAR_INSCRIPTION } from '@/lib/inscription/limites';

export type EtatEnvoi = { erreurs: string[]; ok?: boolean };

/** Mode de développement sans Supabase (jamais sur Netlify) : l'e-mail de confirmation est remplacé par un lien local. */
const modeDev = () => !supabaseConfigure() && !process.env.NETLIFY;

async function exiger(statut: Inscription['statut'] = 'en_cours'): Promise<Inscription> {
  const i = await inscriptionCourante();
  if (!i) redirect('/inscription');
  if (i.statut !== statut) redirect(i.statut === 'en_cours' ? '/inscription/menu' : '/inscription/qr');
  return i;
}

async function ip() {
  const h = await headers();
  return h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnue';
}

async function origine() {
  const h = await headers();
  return process.env.URL_PUBLIQUE?.replace(/\/$/, '') ?? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}

/** Fichiers vérifiés (vrai format, taille, nombre), puis gardés dans la base avec l'inscription. */
async function lireEtStocker(i: Inscription, type: TypeEnvoi, form: FormData): Promise<{ fichiers: (FichierEnvoye & { id: string })[] } | { erreurs: string[] }> {
  const brut = form.getAll('fichiers').filter((f): f is File => f instanceof File && f.size > 0);
  const lus = await Promise.all(brut.map(async (f) => ({ nom: f.name.slice(0, 120), octets: new Uint8Array(await f.arrayBuffer()) })));
  const erreurs = verifierFichiers(type, lus);
  if (erreurs.length) return { erreurs };
  const fichiers = [];
  for (const f of lus) {
    const mediaType = typeReel(f.octets)!; // type réel (signature binaire), pas celui annoncé par le navigateur
    const [r] = await requete<{ id: string }>(
      `insert into inscription_fichier (inscription_id, type, nom, media_type, octets) values ($1, $2, $3, $4, $5) returning id`,
      [i.id, type, f.nom, mediaType, Buffer.from(f.octets)]);
    fichiers.push({ ...f, type: mediaType, id: r.id });
  }
  return { fichiers };
}

const messageErreur = (e: unknown) => (e instanceof Error && /illisible|JPEG/.test(e.message) ? e.message : 'Pat n’a pas pu lire ce document. Réessayez, ou envoyez une photo plus nette.');

// ─── Accueil ──────────────────────────────────────────────────────────────────
export async function commencer() {
  const existante = await inscriptionCourante();
  if (!existante) {
    await nettoyerInscriptions();
    if (!(await inscriptionAutorisee(await ip()))) redirect('/inscription?limite=1');
    await demarrerInscription();
  }
  redirect('/inscription/menu');
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
export async function envoyerMenu(_: EtatEnvoi, form: FormData): Promise<EtatEnvoi> {
  const i = await exiger();
  if (i.analyses >= MAX_ANALYSES_PAR_INSCRIPTION) return { erreurs: ['Nombre maximal d’envois atteint. Contactez-nous pour continuer.'] };
  const r = await lireEtStocker(i, 'menu', form);
  if ('erreurs' in r) return { erreurs: r.erreurs };
  await majInscription(i.id, { analyses: i.analyses + 1 });
  let brut: unknown[];
  try {
    brut = await analyserMenu(r.fichiers);
  } catch (e) {
    console.error('[inscription] menu', e);
    return { erreurs: [messageErreur(e)] };
  }
  const { ok, rejetes } = validerListe(Plat, brut);
  if (!ok.length) return { erreurs: ['Pat n’a reconnu aucun plat sur ce document. Envoyez une photo plus nette ou le PDF du menu.'] };
  await majInscription(i.id, { plats: dedoublonnerPlats([...i.plats, ...ok]) });
  return { ok: true, erreurs: rejetes ? [`${rejetes} ligne(s) illisible(s) ignorée(s) : vérifiez la liste.`] : [] };
}

export async function retirerPlat(index: number) {
  const i = await exiger();
  await majInscription(i.id, { plats: i.plats.filter((_, k) => k !== index) });
  redirect('/inscription/menu');
}

// ─── Vins ─────────────────────────────────────────────────────────────────────
export async function envoyerCarte(_: EtatEnvoi, form: FormData): Promise<EtatEnvoi> {
  const i = await exiger();
  if (i.analyses >= MAX_ANALYSES_PAR_INSCRIPTION) return { erreurs: ['Nombre maximal d’envois atteint. Contactez-nous pour continuer.'] };
  const r = await lireEtStocker(i, 'carte', form);
  if ('erreurs' in r) return { erreurs: r.erreurs };
  await majInscription(i.id, { analyses: i.analyses + 1 });
  let brut: unknown[];
  try {
    brut = await analyserCarte(r.fichiers);
  } catch (e) {
    console.error('[inscription] carte', e);
    return { erreurs: [messageErreur(e)] };
  }
  const { ok, rejetes } = validerListe(Vin, brut);
  if (!ok.length) return { erreurs: ['Pat n’a reconnu aucun vin sur ce document. Envoyez une photo plus nette ou le PDF de la carte.'] };
  const nouveaux = await rapprocherVins(dedoublonnerVins(ok));
  const vins = [...i.vins, ...nouveaux.filter((n) => !i.vins.some((v) => v.libelleCarte === n.libelleCarte && v.millesime === n.millesime && v.contenance === n.contenance))];
  await majInscription(i.id, { vins });
  return { ok: true, erreurs: rejetes ? [`${rejetes} ligne(s) illisible(s) ignorée(s) : vérifiez la liste.`] : [] };
}

/** Producteurs saisis pour les vins dont la carte ne les indique pas (champs « producteur-<index> »). */
export async function completerProducteurs(form: FormData) {
  const i = await exiger();
  const vins = [...i.vins];
  const aRapprocher = vins.map((v, k) => ({ v, k })).filter(({ v, k }) => !v.producteur && String(form.get(`producteur-${k}`) ?? '').trim());
  const rapproches = await rapprocherVins(aRapprocher.map(({ v, k }) => ({ ...v, producteur: String(form.get(`producteur-${k}`)).trim().slice(0, 120) })));
  aRapprocher.forEach(({ k }, n) => { vins[k] = rapproches[n]; });
  await majInscription(i.id, { vins });
  redirect('/inscription/logo');
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
export async function envoyerLogo(_: EtatEnvoi, form: FormData): Promise<EtatEnvoi> {
  const i = await exiger();
  const r = await lireEtStocker(i, 'logo', form);
  if ('erreurs' in r) return { erreurs: r.erreurs };
  const [logo] = r.fichiers;
  const octets = Buffer.from(logo.octets);
  try {
    const [couleurs, clair] = await Promise.all([couleursDuLogo(octets), logoEstClair(octets)]);
    await majInscription(i.id, { logo_fichier: logo.id, couleurs_proposees: couleurs, logo_clair: clair, couleur: i.couleur ?? couleurs[0]?.hex ?? null });
  } catch {
    return { erreurs: ['Logo illisible : envoyez un PNG.'] };
  }
  return { ok: true, erreurs: [] };
}

// ─── Couleur ──────────────────────────────────────────────────────────────────
export async function choisirCouleur(_: EtatEnvoi, form: FormData): Promise<EtatEnvoi> {
  const i = await exiger();
  const hex = String(form.get('couleur') ?? '').trim().toUpperCase();
  const rgb = depuisHex(hex);
  if (!rgb) return { erreurs: ['Code couleur invalide (format #RRGGBB).'] };
  if (!lisibleAvecBlanc(rgb)) return { erreurs: ['Cette couleur est trop claire : le texte blanc de l’app ne serait pas lisible. Choisissez une teinte plus foncée.'] };
  await majInscription(i.id, { couleur: hex.startsWith('#') ? hex : `#${hex}` });
  redirect('/inscription/compte');
}

// ─── Compte ───────────────────────────────────────────────────────────────────
const Compte = z.object({
  nom: z.string().trim().min(2, 'Nom du restaurant requis.').max(80),
  ville: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  motDePasse: z.string().min(12, 'Mot de passe : 12 caractères minimum.').max(128),
  cgu: z.literal('on', { errorMap: () => ({ message: 'Acceptez les conditions d’utilisation.' }) }),
});

export async function creerCompte(_: EtatEnvoi, form: FormData): Promise<EtatEnvoi> {
  const i = await exiger();
  if (!i.plats.length) return { erreurs: ['Ajoutez d’abord votre menu.'] };
  if (!i.vins.length) return { erreurs: ['Ajoutez d’abord votre carte des vins.'] };
  const r = Compte.safeParse(Object.fromEntries(form));
  if (!r.success) return { erreurs: r.error.issues.map((x) => x.message) };

  let userId: string;
  if (modeDev()) {
    userId = randomUUID(); // développement local : pas d'e-mail, un lien de confirmation s'affiche à l'écran
  } else {
    // Compte créé non confirmé : Supabase envoie l'e-mail « Confirm signup », qui mène à /auth/inscription-confirmee.
    const { data, error } = await supabaseService().auth.signUp({
      email: r.data.email, password: r.data.motDePasse,
      options: { emailRedirectTo: `${await origine()}/auth/inscription-confirmee?i=${i.id}` },
    });
    if (error || !data.user) {
      return { erreurs: [/registered|exists/i.test(error?.message ?? '') ? 'Un compte existe déjà avec cette adresse : connectez-vous.' : 'Création du compte impossible. Réessayez.'] };
    }
    // Adresse déjà utilisée : Supabase renvoie un utilisateur sans identité, sans envoyer d'e-mail.
    if (!data.user.identities?.length) return { erreurs: ['Un compte existe déjà avec cette adresse : connectez-vous.'] };
    userId = data.user.id;
  }
  await majInscription(i.id, { statut: 'compte_cree', nom_restaurant: r.data.nom, ville: r.data.ville || null, email: r.data.email, user_id: userId });
  redirect('/inscription/qr');
}

export async function renvoyerEmail() {
  const i = await exiger('compte_cree');
  if (i.email && !modeDev()) {
    await supabaseService().auth.resend({ type: 'signup', email: i.email,
      options: { emailRedirectTo: `${await origine()}/auth/inscription-confirmee?i=${i.id}` } });
  }
  redirect('/inscription/qr?renvoye=1');
}

export async function abandonner() {
  const i = await inscriptionCourante();
  if (i?.statut === 'en_cours') await majInscription(i.id, { statut: 'expiree' });
  redirect('/inscription');
}
