'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requete } from '@/lib/db';
import { COOKIE_VUE, exigerAcces, exigerAdmin } from '@/lib/admin/auth';
import { suggestionsProducteurs } from '@/lib/admin/donnees';
import { deposerImage } from '@/lib/admin/fichiers';
import { creerLot, travailler } from '@/lib/generation/file';
import Anthropic from '@anthropic-ai/sdk';
import { genererPresentations, SQL_VINS_A_PRESENTER, type VinPresentation } from '@/lib/generation/presentations';
import { creerLotPresentations, preparationEnCours, presentationsManquantes, travaillerPresentations } from '@/lib/generation/file-presentations';
import { supabaseConfigure, supabaseService, supabaseSession } from '@/lib/admin/supabase';
import { parametresEnService } from '@/lib/regles/versions';
import { repriseALaConnexion } from '@/lib/inscription/reprise';
import { partagerEtiquettes } from '@/lib/etiquettes/partage';
import { chercherEtiquettesManquantes } from '@/lib/etiquettes/lancer';
import { REGLAGES_INTERNES, type Reglages } from '@/lib/selection';

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const nombre = (f: FormData, k: string) => {
  const v = txt(f, k);
  if (v === null) return null;
  const n = Number(v.replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const fichier = (f: FormData, k: string) => {
  const v = f.get(k);
  return v instanceof File && v.size > 0 ? v : null;
};
const avec = (url: string, params: Record<string, string>) => `${url}?${new URLSearchParams(params)}`;

// ───────── Connexion ─────────
export async function seConnecter(f: FormData) {
  if (!supabaseConfigure()) redirect('/admin');
  const supabase = await supabaseSession();
  const { error } = await supabase.auth.signInWithPassword({ email: txt(f, 'email') ?? '', password: String(f.get('mdp') ?? '') });
  if (error) redirect(avec('/admin/connexion', { erreur: 'E-mail ou mot de passe incorrect.' }));
  // Inscription dont le lien de confirmation n'a pas abouti : le restaurant est créé maintenant.
  const { data } = await supabase.auth.getUser();
  let resto: string | null = null;
  if (data.user) {
    const [a] = await requete('select 1 from acces_restaurant where user_id = $1 limit 1', [data.user.id]);
    if (!a) resto = await repriseALaConnexion(data.user.id).catch((e) => { console.error('[inscription] reprise', e); return null; });
  }
  redirect(resto ? `/admin/${resto}` : '/admin');
}

export async function seDeconnecter() {
  if (supabaseConfigure()) await (await supabaseSession()).auth.signOut();
  (await cookies()).delete(COOKIE_VUE); // fin de l'« Aperçu côté restaurant »
  redirect('/admin/connexion');
}

export async function motDePasseOublie(f: FormData) {
  if (!supabaseConfigure()) redirect('/admin/connexion');
  const h = await headers();
  const origine = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  await (await supabaseSession()).auth.resetPasswordForEmail(txt(f, 'email') ?? '', { redirectTo: `${origine}/admin/auth/retour?suite=/admin/mot-de-passe` });
  redirect(avec('/admin/connexion', { info: 'Si ce compte existe, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe.' }));
}

export async function changerMotDePasse(f: FormData) {
  const mdp = String(f.get('mdp') ?? '');
  if (mdp.length < 10) redirect(avec('/admin/mot-de-passe', { erreur: '10 caractères minimum.' }));
  if (mdp !== f.get('mdp2')) redirect(avec('/admin/mot-de-passe', { erreur: 'Les deux mots de passe sont différents.' }));
  const { error } = await (await supabaseSession()).auth.updateUser({ password: mdp });
  if (error) redirect(avec('/admin/mot-de-passe', { erreur: error.message }));
  redirect('/admin');
}

// ───────── Menu ─────────
export async function enregistrerPlat(resto: string, platId: string, f: FormData) {
  await exigerAcces(resto);
  const cat = txt(f, 'categorie');
  await requete(
    `update plat set nom = coalesce($3, nom), nom_court = $4, categorie = coalesce($5::categorie_plat, categorie), prix = $6,
            prix_variantes = $7, actif = $8, modifie_bo = now(),
            -- Description ou sauce changée après le calcul des accords : le back-office le signale.
            description_modifiee_le = case when coalesce(description_cuisine, '') <> coalesce($9, '') or sauce_servie_a_part is distinct from $10::boolean
                                           then now() else description_modifiee_le end,
            description_cuisine = $9,
            -- Sauce servie à part : oui (condiment, principe n°44), non (composante du plat), vide (je ne sais pas).
            sauce_servie_a_part = $10::boolean
      where id = $1 and restaurant_id = $2`,
    [platId, resto, txt(f, 'nom'), txt(f, 'nom_court'), ['entree', 'plat', 'dessert', 'fromage'].includes(cat ?? '') ? cat : null,
      nombre(f, 'prix'), txt(f, 'prix_variantes'), f.get('actif') === 'on', txt(f, 'description_cuisine'),
      f.get('sauce') === 'oui' ? true : f.get('sauce') === 'non' ? false : null],
  );
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/menu`, { plat: platId, ok: '1' }));
}

// ───────── Carte des vins ─────────
export async function enregistrerVin(resto: string, vinId: string, f: FormData) {
  await exigerAcces(resto);
  let etiquette: string | null = null;
  const image = fichier(f, 'etiquette');
  if (image) {
    try {
      etiquette = await deposerImage(image, `${resto}/etiquettes`);
    } catch (e) {
      redirect(avec(`/admin/${resto}/carte`, { vin: vinId, erreur: (e as Error).message }));
    }
  }
  await enregistrerProducteurDuVin(resto, vinId, txt(f, 'producteur_texte'), txt(f, 'producteur_choix'));
  await requete(
    `update vin_carte set millesime = $3, prix = $4, prix_verre = $5, resume_court = $6, disponible = $7, coup_de_coeur = $8,
            etiquette_url = coalesce($9, etiquette_url),
            etiquette_source = case when $9::text is not null then 'restaurant' else etiquette_source end,
            etiquette_statut = case when $9::text is not null then 'trouvee' else etiquette_statut end,
            presentation_carte_perso = $10, modifie_bo = now()
      where id = $1 and restaurant_id = $2`,
    [vinId, resto, txt(f, 'millesime'), nombre(f, 'prix'), nombre(f, 'prix_verre'), txt(f, 'resume_court'),
      f.get('disponible') === 'on', f.get('coup_de_coeur') === 'on', etiquette, txt(f, 'presentation_carte_perso')],
  );
  // L'étiquette rejoint la cuvée dans la base de Pat ; les autres cartes qui ont cette cuvée sans photo la reprennent.
  const partagees = await partagerEtiquettes(requete, { vins: [vinId], nouvellePhoto: etiquette ? vinId : undefined })
    .catch((e) => { console.error('[etiquettes] partage', e); return 0; });
  revalidatePath(partagees ? '/' : `/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/carte`, { vin: vinId, ok: '1' }));
}

/** Étiquettes manquantes de la carte : demandées à Wine Labs (une par cuvée), réservé au super-admin (crédits). */
export async function chercherEtiquettes(resto: string) {
  await exigerAdmin();
  let n = 0;
  try {
    n = await chercherEtiquettesManquantes(resto, { relancer: true });
  } catch (e) {
    redirect(avec(`/admin/${resto}/carte`, { erreur: (e as Error).message }));
  }
  revalidatePath(`/admin/${resto}/carte`);
  redirect(avec(`/admin/${resto}/carte`, n ? { ok: `${n} étiquette(s) demandée(s) à Wine Labs.` } : { erreur: 'Aucune étiquette à demander (déjà en recherche, introuvables ou partagées par la base).' }));
}

/**
 * Producteur d'un vin.
 * - choix = id d'un producteur de la base : le vin y est relié et reprend son ranking.
 * - choix = « nouveau » : le nom saisi devient un producteur proposé à Pat (ranking 3), relié au vin.
 * - nom saisi ou changé sans choix : recherche dans la base. Un seul nom correspondant → relié ;
 *   aucun nom proche → nouveau producteur proposé (ranking 3) ; des noms proches → ils sont proposés au choix.
 * - nom vidé : le vin n'est plus relié (« Producteur à préciser »).
 */
async function enregistrerProducteurDuVin(resto: string, vinId: string, nom: string | null, choix: string | null) {
  const [v] = await requete<{ producteur_id: string | null; producteur_texte: string | null; pays: string | null; section: string | null; couleur: string }>(
    'select producteur_id, producteur_texte, pays, section, couleur::text from vin_carte where id = $1 and restaurant_id = $2', [vinId, resto]);
  if (!v) return;
  const relier = async (id: string, texte: string | null) => {
    const [p] = await requete<{ nom: string; ranking_pat: number | null }>(`select nom, ranking_pat from producteur where id = $1 and statut <> 'retire'`, [id]);
    if (!p) return;
    await requete(
      `update vin_carte set producteur_id = $3, producteur_texte = $4, ranking_producteur = coalesce($5, ranking_producteur)
        where id = $1 and restaurant_id = $2`,
      [vinId, resto, id, texte ?? p.nom, p.ranking_pat],
    );
  };
  const proposer = async (texte: string) => {
    const base = `bo-prod-${texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`;
    const [deja] = await requete<{ id: string }>(`select id from producteur where id = $1 or (statut = 'propose' and lower(nom) = lower($2))`, [base, texte]);
    const id = deja?.id ?? base;
    if (!deja) {
      await requete(
        `insert into producteur (id, nom, pays, region, couleurs, ranking_pat, statut, source, a_verifier)
         values ($1, $2, $3, $4, $5, 3, 'propose', $6, 'Ajouté depuis le back-office : fiche à compléter par Pat')`,
        [id, texte, v.pays, v.section, [v.couleur], `back-office ${resto} (${vinId})`],
      );
    }
    await requete(
      `update vin_carte set producteur_id = $3, producteur_texte = $4, ranking_producteur = 3 where id = $1 and restaurant_id = $2`,
      [vinId, resto, id, texte],
    );
  };

  if (choix === 'nouveau' && nom) return proposer(nom);
  if (choix && choix !== 'nouveau' && choix !== v.producteur_id) return relier(choix, nom);
  if (!nom) {
    await requete('update vin_carte set producteur_id = null, producteur_texte = null where id = $1 and restaurant_id = $2', [vinId, resto]);
    return;
  }
  if (nom === v.producteur_texte && v.producteur_id) return;
  // Nom saisi ou changé : recherche dans la base de Pat.
  const suggestions = await suggestionsProducteurs(nom, 5);
  const exact = suggestions.filter((p) => p.nom.toLowerCase() === nom.toLowerCase());
  if (exact.length === 1) return relier(exact[0].id, nom);
  if (!suggestions.length) return proposer(nom);
  // Des noms proches existent : le restaurant choisit (le vin n'est relié qu'après son choix).
  await requete('update vin_carte set producteur_id = null, producteur_texte = $3 where id = $1 and restaurant_id = $2', [vinId, resto, nom]);
}

// ───────── Accords ─────────
export async function changerNote(resto: string, platId: string, vinId: string, f: FormData) {
  const u = await exigerAcces(resto);
  const note = Number(f.get('note'));
  if (note >= 1 && note <= 5) {
    await requete(
      `update accord set note = $4, origine = 'sommelier', modifie_par = $5, calcule_le = now()
        where restaurant_id = $1 and plat_id = $2 and vin_id = $3`,
      [resto, platId, vinId, note, u.email],
    );
  }
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/accords`, { plat: platId }));
}

/**
 * Commentaire d'accord réécrit par le restaurant : remplace celui de Pat chez le client et n'est plus régénéré.
 * Texte vide : le commentaire redevient celui de Pat (réécrit à la prochaine régénération).
 */
export async function modifierCommentaire(resto: string, platId: string, vinId: string, f: FormData) {
  const u = await exigerAcces(resto);
  const texte = (txt(f, 'commentaire') ?? '').replace(/\s+/g, ' ').slice(0, 400) || null;
  await requete(
    `update accord set commentaire_sommelier = $4, explication = coalesce($4, explication), modifie_par = $5
      where restaurant_id = $1 and plat_id = $2 and vin_id = $3`,
    [resto, platId, vinId, texte, u.email],
  );
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/accords`, { plat: platId, ...(f.get('tous') ? { tous: '1' } : {}), commentaire: '1' }));
}

export async function validerPlat(resto: string, platId: string) {
  const u = await exigerAcces(resto);
  await requete(
    `update accord set statut = 'valide', valide_le = now(), modifie_par = coalesce(modifie_par, $3)
      where restaurant_id = $1 and plat_id = $2 and statut = 'propose'`, [resto, platId, u.email]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/accords`, { plat: platId, ok: '1' }));
}

export async function validerTout(resto: string) {
  const u = await exigerAcces(resto);
  await requete(
    `update accord set statut = 'valide', valide_le = now(), modifie_par = coalesce(modifie_par, $2)
      where restaurant_id = $1 and statut = 'propose'`, [resto, u.email]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/accords`);
}

// ───────── Régénération des accords par Pat ─────────
/**
 * Lance le traitement de la file : fonctions Netlify d'arrière-plan (3 en parallèle au plus) ;
 * hors Netlify (développement local), le serveur traite la file lui-même, sans faire attendre la page.
 */
async function lancerFonctions(fonction: string, nombre: number, surPlace: () => Promise<unknown>) {
  const h = await headers();
  const origine = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const appels = await Promise.all(Array.from({ length: Math.min(3, nombre) }, () =>
    fetch(`${origine}/.netlify/functions/${fonction}`, { method: 'POST' }).then((r) => r.status).catch(() => 0)));
  if (!appels.some((s) => s === 202 || s === 200)) void surPlace().catch((e) => console.error(`[${fonction}]`, e));
}

async function lancerTravailleurs(nombre: number) {
  await lancerFonctions('generer-accords-background', nombre, () => travailler(requete, { finAvant: Date.now() + 60 * 60 * 1000 }));
}

async function regenerer(resto: string, platIds: string[], retour: Record<string, string>) {
  const u = await exigerAcces(resto);
  if (!process.env.ANTHROPIC_API_KEY) redirect(avec(`/admin/${resto}/accords`, { ...retour, erreur: 'Clé Claude absente : ANTHROPIC_API_KEY n’est pas configurée.' }));
  const { crees } = await creerLot(requete, resto, platIds, u.email);
  if (crees) await lancerTravailleurs(crees);
  revalidatePath(`/admin/${resto}/accords`);
  redirect(avec(`/admin/${resto}/accords`, { ...retour, regeneration: crees ? '1' : 'deja' }));
}

export async function regenererTout(resto: string) {
  await exigerAcces(resto);
  const plats = await requete<{ id: string }>('select id from plat where restaurant_id = $1 and actif order by ordre', [resto]);
  await regenerer(resto, plats.map((p) => p.id), {});
}

// ───────── Carte imprimée ─────────
/**
 * Bouton « Imprimer la carte » : Pat écrit d'abord les présentations qui manquent (en arrière-plan, une tâche par couleur),
 * la page d'attente ouvre ensuite le menu d'impression. S'il ne manque rien, on y va directement.
 * Renvoie l'adresse à ouvrir (dans un nouvel onglet, par le bouton BoutonCarteImprimee).
 */
export async function preparerImpression(resto: string): Promise<string> {
  const u = await exigerAcces(resto);
  const imprimer = `/admin/${resto}/carte/imprimer`;
  if (!process.env.ANTHROPIC_API_KEY) return imprimer;
  const manquantes = await presentationsManquantes(requete, resto);
  const crees = manquantes.length ? await creerLotPresentations(requete, resto, manquantes.map((m) => m.couleur), u.email) : 0;
  if (crees) await lancerFonctions('generer-presentations-background', crees, () => travaillerPresentations(requete, { finAvant: Date.now() + 60 * 60 * 1000 }));
  if (!crees && !(await preparationEnCours(requete, resto))) return imprimer;
  return `/admin/${resto}/carte/preparer`;
}

/** Relecture d'une présentation (rubrique Supports) : le texte du restaurant prime et n'est jamais régénéré ; vide = celle de Pat. */
export async function enregistrerPresentation(resto: string, vinId: string, f: FormData) {
  await exigerAcces(resto);
  const texte = (txt(f, 'presentation') ?? '').replace(/\s+/g, ' ').slice(0, 600) || null;
  await requete(`update vin_carte set presentation_carte_perso = $3 where restaurant_id = $1 and id = $2`, [resto, vinId, texte]);
  revalidatePath(`/admin/${resto}/supports`);
  redirect(`/admin/${resto}/supports?ok=${encodeURIComponent(vinId)}#${vinId}`);
}

/** « Autre proposition » : Pat réécrit la présentation de ce vin (en voyant celles des autres vins de la même couleur). */
export async function autrePresentation(resto: string, vinId: string) {
  await exigerAcces(resto);
  const retour = `/admin/${resto}/supports`;
  if (!process.env.ANTHROPIC_API_KEY) redirect(`${retour}?erreur=${encodeURIComponent('Clé Claude absente : ANTHROPIC_API_KEY n’est pas configurée.')}#${vinId}`);
  // Le vin est repris même si le restaurant avait corrigé son texte : il demande explicitement une nouvelle proposition.
  const [vin] = await requete<VinPresentation>(SQL_VINS_A_PRESENTER.replace('and v.presentation_carte_perso is null', '') + ' and v.id = $2', [resto, vinId]);
  const [r] = await requete<{ nom: string }>('select nom from restaurant where id = $1', [resto]);
  if (!vin || !r) redirect(retour);
  const existants = await requete<{ couleur: string; texte: string }>(
    `select couleur::text as couleur, coalesce(presentation_carte_perso, presentation_carte) as texte from vin_carte
      where restaurant_id = $1 and couleur::text = $2 and disponible and id <> $3 and coalesce(presentation_carte_perso, presentation_carte) is not null`,
    [resto, vin.couleur, vinId]);
  const [actuel] = await requete<{ texte: string | null }>(`select coalesce(presentation_carte_perso, presentation_carte) as texte from vin_carte where id = $1`, [vinId]);
  let erreur: string | null = null;
  try {
    // L'ancien texte est montré au modèle comme « déjà écrit » : la proposition sera différente.
    const textes = await genererPresentations([vin], r.nom, new Anthropic({ maxRetries: 3 }), process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
      { existants: [...existants, ...(actuel?.texte ? [{ couleur: vin.couleur, texte: actuel.texte }] : [])] });
    if (textes[vinId]) {
      await requete(`update vin_carte set presentation_carte = $3, presentation_carte_perso = null where restaurant_id = $1 and id = $2`, [resto, vinId, textes[vinId]]);
    } else erreur = 'Pat n’a pas trouvé de proposition valide : réessayez, ou écrivez le texte vous-même.';
  } catch (e) {
    console.error('[presentation]', e);
    erreur = 'Pat n’a pas pu écrire de proposition pour le moment : réessayez dans un instant.';
  }
  revalidatePath(retour);
  redirect(erreur ? `${retour}?erreur=${encodeURIComponent(erreur)}#${vinId}` : `${retour}?nouvelle=${encodeURIComponent(vinId)}#${vinId}`);
}

// ───────── Règles ─────────
export async function enregistrerReglages(resto: string, f: FormData) {
  await exigerAcces(resto);
  // Ajustements = écarts avec les règles de Pat en service (une valeur égale suit les futures versions de Pat).
  const base = await parametresEnService(requete);
  const diff: Partial<Reglages> = {};
  for (const k of Object.keys(base) as (keyof Reglages)[]) {
    if (REGLAGES_INTERNES.includes(k)) continue;
    const pat = base[k];
    if (typeof pat === 'boolean') {
      const v = f.get(k) === 'on';
      if (v !== pat) (diff[k] as boolean) = v;
    } else {
      const v = nombre(f, k);
      if (v !== null && v !== pat) (diff[k] as number) = v;
    }
  }
  if ((diff.premiers ?? base.premiers) > (diff.maximum ?? base.maximum)) diff.maximum = diff.premiers;
  await requete('update restaurant set reglages_selection = $2 where id = $1', [resto, JSON.stringify(diff)]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/regles`, { ok: '1' }));
}

export async function retablirReglage(resto: string, cle: string) {
  await exigerAcces(resto);
  await requete(`update restaurant set reglages_selection = reglages_selection - $2 where id = $1`, [resto, cle]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/regles`);
}

export async function retablirTout(resto: string) {
  await exigerAcces(resto);
  await requete(`update restaurant set reglages_selection = '{}' where id = $1`, [resto]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/regles`);
}

export async function retirerVin(resto: string, f: FormData) {
  await exigerAcces(resto);
  const vin = txt(f, 'vin');
  if (vin) {
    const [v] = await requete<{ libelle: string }>('select libelle from vin_carte where id = $1 and restaurant_id = $2', [vin, resto]);
    if (v) {
      await requete(
        `insert into regle_sommelier (id, restaurant_id, type, portee, cible, texte, date_fin, actif)
         values ($1, $2, 'exclure', 'vin', $3, $4, $5, true) on conflict (id) do update set actif = true, date_fin = excluded.date_fin`,
        [`${resto}-bo-exclure-${vin.toLowerCase()}`, resto, vin, `Ne plus proposer ${v.libelle}`, txt(f, 'jusqua')],
      );
    }
  }
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/regles`);
}

export async function remettreVin(resto: string, id: string) {
  await exigerAcces(resto);
  await requete(`delete from regle_sommelier where id = $1 and restaurant_id = $2 and id like '%-bo-%'`, [id, resto]);
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(`/admin/${resto}/regles`);
}

// ───────── Apparence ─────────
function claire(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const m = (x: number) => Math.round(x + (255 - x) * 0.93).toString(16).padStart(2, '0');
  return `#${m((n >> 16) & 255)}${m((n >> 8) & 255)}${m(n & 255)}`.toUpperCase();
}

export async function enregistrerApparence(resto: string, f: FormData) {
  await exigerAcces(resto);
  const couleur = txt(f, 'couleur');
  if (!couleur || !/^#[0-9a-f]{6}$/i.test(couleur)) redirect(avec(`/admin/${resto}/apparence`, { erreur: 'Couleur invalide : utilisez un code comme #BA4037.' }));
  let logo: string | null = null;
  let logoFonce: string | null = null;
  try {
    const l = fichier(f, 'logo');
    if (l) logo = await deposerImage(l, `${resto}/logo`);
    const lf = fichier(f, 'logo_fonce');
    if (lf) logoFonce = await deposerImage(lf, `${resto}/logo`);
  } catch (e) {
    redirect(avec(`/admin/${resto}/apparence`, { erreur: (e as Error).message }));
  }
  const accroche = [txt(f, 'accroche1'), txt(f, 'accroche2')].filter(Boolean).join('|') || null;
  await requete(
    `update restaurant set couleur = $2, couleur_claire = $3, accroche = $4, logo_url = coalesce($5, logo_url),
            logo_fonce_url = coalesce($6, logo_fonce_url), modifie_bo = now()
      where id = $1`,
    [resto, couleur.toUpperCase(), claire(couleur), accroche, logo, logoFonce],
  );
  revalidatePath(`/admin/${resto}`, 'layout');
  revalidatePath(`/${resto}`, 'layout');
  redirect(avec(`/admin/${resto}/apparence`, { ok: '1' }));
}

// ───────── Accès ─────────
export async function creerAcces(resto: string, f: FormData) {
  await exigerAcces(resto);
  const email = (txt(f, 'email') ?? '').toLowerCase();
  const mdp = String(f.get('mdp') ?? '');
  const retour = (m: Record<string, string>) => redirect(avec(`/admin/${resto}/acces`, m));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) retour({ erreur: 'Adresse e-mail invalide.' });
  if (mdp.length < 10) retour({ erreur: 'Mot de passe : 10 caractères minimum.' });
  if (mdp !== f.get('mdp2')) retour({ erreur: 'Les deux mots de passe sont différents.' });

  let userId: string | null = null;
  try {
    const sb = supabaseService();
    const { data, error } = await sb.auth.admin.createUser({ email, password: mdp, email_confirm: true });
    if (data.user) userId = data.user.id;
    else if (error && /already|registered|exists/i.test(error.message)) {
      // Compte existant (autre restaurant) : on le relie simplement à celui-ci, sans toucher à son mot de passe.
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data: l } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        userId = l.users.find((x) => x.email?.toLowerCase() === email)?.id ?? null;
        if (l.users.length < 200) break;
      }
    } else if (error) throw error;
  } catch (e) {
    retour({ erreur: `Création du compte impossible : ${(e as Error).message}` });
  }
  if (!userId) retour({ erreur: 'Compte introuvable.' });
  await requete(
    `insert into acces_restaurant (user_id, email, restaurant_id) values ($1, $2, $3) on conflict do nothing`,
    [userId, email, resto],
  );
  revalidatePath(`/admin/${resto}`, 'layout');
  retour({ ok: `Accès créé pour ${email}.` });
}

export async function retirerAcces(resto: string, userId: string) {
  await exigerAcces(resto);
  await requete('delete from acces_restaurant where restaurant_id = $1 and user_id = $2', [resto, userId]);
  revalidatePath(`/admin/${resto}`, 'layout');
  redirect(`/admin/${resto}/acces`);
}

// ───────── Base de Pat (administrateur) ─────────
