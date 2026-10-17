'use server';
/**
 * Actions de l'espace super-admin (Pat). Chacune vérifie d'abord que l'utilisateur est super-admin.
 */
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_VUE, exigerAdmin, exigerSuperAdminReel } from '@/lib/admin/auth';
import { supabaseService } from '@/lib/admin/supabase';
import { requete } from '@/lib/db';
import { grouperMemeVin } from '@/lib/contenances';
import { preparerAccords } from '@/lib/inscription/adaptateurs';
import { importerVersion, modifierPrincipeBrouillon } from '@/lib/principes/versions';
import { validerProducteur, rejeterProducteur } from '@/lib/producteurs/validation';
import { annulerPublication, confirmerPublication, preparerPublication, relancerEchecs, travaillerPublications, type TypePublication } from '@/lib/publication/publication';
import { enregistrerBrouillonRegles } from '@/lib/regles/versions';
import { appelerWineLabs } from '@/lib/etiquettes/wine-labs';
import { PLATS_EN_PARALLELE } from '@/lib/generation/file';
import { parametresRegles, REGLAGES_PAT, type Reglages } from '@/lib/selection';
import { traiterRelecturesPrix } from '@/lib/inscription/prix';
import { typeReel, verifierFichiers } from '@/lib/inscription/fichiers';
import { traiterComparaisons } from '@/lib/generation/comparaison';
import { deposerImage } from '@/lib/admin/fichiers';
import { appellationCourte } from '@/lib/admin/intitule';

const txt = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
const avec = (url: string, params: Record<string, string>) => `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`;
const entier = (f: FormData, k: string) => { const v = txt(f, k); return v === null ? null : Number.isInteger(Number(v)) ? Number(v) : NaN; };

async function origine() {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}

// ───────── « Aperçu côté restaurant » ─────────
export async function voirCommeRestaurant(restaurantId: string) {
  await exigerAdmin();
  (await cookies()).set(COOKIE_VUE, restaurantId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 3600 });
  redirect(`/admin/${restaurantId}`);
}

export async function quitterVueRestaurant() {
  await exigerSuperAdminReel();
  (await cookies()).delete(COOKIE_VUE);
  redirect('/admin/super');
}

// ───────── Restaurants ─────────
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
/** Fond clair de la barre Pat : la couleur du restaurant mêlée de blanc. */
function couleurClaire(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const m = (c: number) => Math.round(c + (255 - c) * 0.88).toString(16).padStart(2, '0');
  return `#${m((n >> 16) & 255)}${m((n >> 8) & 255)}${m(n & 255)}`.toUpperCase();
}

export async function creerRestaurant(f: FormData) {
  const u = await exigerAdmin();
  const retour = (m: Record<string, string>) => redirect(avec('/admin/super', m));
  const nom = txt(f, 'nom');
  const email = (txt(f, 'email') ?? '').toLowerCase();
  const couleur = /^#[0-9a-f]{6}$/i.test(txt(f, 'couleur') ?? '') ? txt(f, 'couleur')! : '#680021';
  const langues = ['fr', 'nl', 'en'].filter((l) => f.get(`langue_${l}`) === 'on');
  if (!nom) retour({ erreur: 'Nom du restaurant manquant.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) retour({ erreur: 'Adresse e-mail du responsable invalide.' });
  let id = slug(nom!);
  if (!id) retour({ erreur: 'Nom du restaurant invalide.' });
  for (let i = 2; (await requete('select 1 from restaurant where id = $1', [id])).length; i++) id = `${slug(nom!)}-${i}`;

  await requete(
    `insert into restaurant (id, nom, couleur, couleur_claire, accroche, statut, ville, langues, cree_par)
     values ($1, $2, $3, $4, $5, 'mise_en_place', $6, $7, $8)`,
    [id, nom, couleur, couleurClaire(couleur), `Bienvenue chez ${nom} !`, txt(f, 'ville'), langues.length ? langues : ['fr'], u.email]);

  // Invitation par e-mail : le responsable choisit son mot de passe en cliquant sur le lien.
  let message = `Restaurant ${nom} créé.`;
  try {
    const sb = supabaseService();
    const { data, error } = await sb.auth.admin.inviteUserByEmail(email, { redirectTo: `${await origine()}/admin/mot-de-passe` });
    let userId = data?.user?.id ?? null;
    if (!userId && error && /already|registered|exists/i.test(error.message)) {
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data: l } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        userId = l.users.find((x) => x.email?.toLowerCase() === email)?.id ?? null;
        if (l.users.length < 200) break;
      }
      message += ` ${email} avait déjà un compte : il est relié à ce restaurant.`;
    } else if (error) throw error;
    else message += ` Invitation envoyée à ${email}.`;
    if (userId) await requete(`insert into acces_restaurant (user_id, email, restaurant_id) values ($1, $2, $3) on conflict do nothing`, [userId, email, id]);
  } catch (e) {
    message += ` Invitation non envoyée (${(e as Error).message}) : créez l’accès depuis « Accès & QR code ».`;
  }
  revalidatePath('/admin', 'layout');
  retour({ ok: message });
}

/**
 * Supprime définitivement un restaurant (restaurants de test, inscriptions abandonnées) : menu, carte, accords, règles,
 * accès et file de génération partent avec lui. Le nom doit être retapé (vérifié ici). Les comptes ne sont pas supprimés
 * (un compte peut avoir d'autres restaurants) ; les producteurs proposés par cette seule carte sont retirés de la file à valider,
 * sauf ceux dont les cuvées portent une étiquette (base de Pat).
 */
export async function supprimerRestaurant(restaurantId: string, f: FormData) {
  await exigerSuperAdminReel();
  const [r] = await requete<{ nom: string }>('select nom from restaurant where id = $1', [restaurantId]);
  if (!r) redirect(avec('/admin/super', { erreur: 'Restaurant introuvable.' }));
  if (txt(f, 'confirmation') !== r.nom) redirect(avec('/admin/super', { erreur: 'Le nom retapé ne correspond pas : rien n’a été supprimé.' }));
  const producteurs = (await requete<{ producteur_id: string }>(
    'select distinct producteur_id from vin_carte where restaurant_id = $1 and producteur_id is not null', [restaurantId])).map((p) => p.producteur_id);
  await requete('delete from inscription where restaurant_id = $1', [restaurantId]); // et ses fichiers
  await requete('delete from restaurant where id = $1', [restaurantId]); // plats, vins, accords, règles, accès : en cascade
  // Producteurs proposés par cette seule carte : retirés de la file, sauf s'ils portent des étiquettes
  // (cuvées avec photo) — elles servent aux autres cartes, et à ce restaurant s'il est recréé.
  await requete(`delete from producteur p where p.id = any($1) and p.statut = 'propose' and p.source = 'inscription'
                   and not exists (select 1 from vin_carte v where v.producteur_id = p.id)
                   and not exists (select 1 from cuvee c where c.producteur_id = p.id and c.etiquette_url is not null)`, [producteurs]);
  if ((await cookies()).get(COOKIE_VUE)?.value === restaurantId) (await cookies()).delete(COOKIE_VUE);
  revalidatePath('/admin', 'layout');
  redirect(avec('/admin/super', { ok: `« ${r.nom} » a été supprimé.` }));
}

export async function changerStatutRestaurant(restaurantId: string, f: FormData) {
  await exigerAdmin();
  const statut = txt(f, 'statut');
  if (statut && ['mise_en_place', 'en_service', 'suspendu'].includes(statut)) {
    await requete('update restaurant set statut = $2 where id = $1', [restaurantId, statut]);
  }
  revalidatePath('/admin/super');
  redirect('/admin/super');
}

/** « Relancer la préparation » : les plats sans accord ou en échec repartent dans la file. */
export async function relancerPreparation(restaurantId: string) {
  const u = await exigerAdmin();
  await preparerAccords(restaurantId, u.email, { seulementManquants: true });
  revalidatePath('/admin/super');
  redirect(avec('/admin/super', { ok: 'Préparation relancée.' }));
}

// ───────── Producteurs à valider ─────────
/** Rankings saisis sur la fiche : producteur, terroirs (rkt_<id>) et cuvées de carte (rkv_<id>, vide = celui du producteur). */
function lireRankings(f: FormData) {
  const terroirs: { terroirId: string; rankingTerroir: number }[] = [];
  const vins: { vinId: string; ranking: number | null }[] = [];
  for (const [k, v] of f.entries()) {
    if (typeof v !== 'string') continue;
    if (k.startsWith('rkt_') && v.trim() !== '') terroirs.push({ terroirId: k.slice(4), rankingTerroir: Number(v) });
    // Note d'un vin de la base (cuvée) : un même vin peut figurer sur plusieurs lignes (plusieurs cartes).
    if (k.startsWith('rkc_')) vins.push({ vinId: k.slice(4), ranking: v.trim() === '' ? null : Number(v) });
  }
  return { terroirs, vins };
}

/** Retour à la liste des producteurs avec ses filtres (seulement une adresse de cette liste). */
const retourProducteurs = (f: FormData) => {
  const r = txt(f, 'retour');
  return r && /^\/admin\/super\/producteurs(\?[^\s]*)?$/.test(r) ? r : '/admin/super/producteurs';
};

/** « Valider » depuis la liste, sans ouvrir la fiche : ranking saisi (suggestion de Pat par défaut), rankings des cuvées gardés. */
export async function validerDepuisListe(producteurId: string, f: FormData) {
  const u = await exigerAdmin();
  const r = await validerProducteur(requete, { producteurId, rankingProducteur: entier(f, 'ranking') ?? NaN, par: u.email });
  revalidatePath('/admin', 'layout');
  redirect(avec(retourProducteurs(f), r.erreurs.length
    ? { erreur: r.erreurs.join(' ') }
    : { ok: `Producteur validé : ${r.vins} vin(s) de carte passent « Déjà référencé »${r.restaurants.length ? ` (${r.restaurants.join(', ')})` : ''}.` }));
}

export async function decisionProducteur(producteurId: string, f: FormData) {
  const u = await exigerAdmin();
  const page = `/admin/super/producteurs/${encodeURIComponent(producteurId)}`;
  const decision = txt(f, 'decision');
  const [{ statut } = { statut: '' }] = await requete<{ statut: string }>('select statut::text from producteur where id = $1', [producteurId]);
  if (decision === 'rejeter' && statut !== 'valide') {
    await rejeterProducteur(requete, { producteurId, motif: txt(f, 'motif') ?? '', par: u.email });
    revalidatePath('/admin', 'layout');
    redirect(avec('/admin/super/producteurs', { ok: 'Producteur rejeté : ses vins restent « Nouveau producteur ».' }));
  }
  const fiche = { nom: txt(f, 'nom') ?? undefined, pays: txt(f, 'pays'), region: txt(f, 'region'), notes_objectives: txt(f, 'notes_objectives') };
  const { terroirs, vins } = lireRankings(f);
  const rk = entier(f, 'ranking');
  if (decision === 'valider' && statut !== 'valide') {
    const r = await validerProducteur(requete, { producteurId, rankingProducteur: rk ?? NaN, terroirs, fiche, par: u.email });
    if (r.erreurs.length) redirect(avec(page, { erreur: r.erreurs.join(' ') }));
    await enregistrerNotesCuvees(producteurId, vins);
    revalidatePath('/admin', 'layout');
    redirect(avec('/admin/super/producteurs', { ok: `Producteur validé : ${r.vins} vin(s) de carte passent « Déjà référencé »${r.restaurants.length ? ` (${r.restaurants.join(', ')})` : ''}.` }));
  }
  // Enregistrer sans valider : fiche et rankings (le producteur reste à valider).
  if (rk !== null && !(rk >= 0 && rk <= 5)) redirect(avec(page, { erreur: 'Ranking du producteur : entier de 0 à 5.' }));
  await requete(
    `update producteur set nom = coalesce($2, nom), pays = $3, region = $4, notes_objectives = $5,
            -- Producteur validé : le ranking saisi est son ranking ; sinon une suggestion en attendant la validation.
            ranking_pat = case when statut = 'valide' then coalesce($6, ranking_pat) else ranking_pat end,
            ranking_suggere = case when statut = 'valide' then ranking_suggere else coalesce($6, ranking_suggere) end, maj_le = now() where id = $1`,
    [producteurId, fiche.nom ?? null, fiche.pays, fiche.region, fiche.notes_objectives, rk]);
  for (const t of terroirs) if (t.rankingTerroir >= 0 && t.rankingTerroir <= 5) await requete('update terroir set ranking_pat = $2, maj_le = now() where id = $1', [t.terroirId, t.rankingTerroir]);
  await enregistrerNotesCuvees(producteurId, vins);
  revalidatePath('/admin', 'layout');
  redirect(avec(page, { ok: statut === 'valide' ? 'Fiche enregistrée.' : 'Fiche enregistrée (producteur toujours à valider).' }));
}

/**
 * Notes des vins de la base d'un producteur (fiche du producteur) : vide = celle du producteur s'applique.
 * Un même vin peut apparaître sur plusieurs lignes (plusieurs cartes) : la valeur modifiée l'emporte.
 */
async function enregistrerNotesCuvees(producteurId: string, saisies: { vinId: string; ranking: number | null }[]) {
  if (!saisies.length) return;
  const actuelles = new Map((await requete<{ id: string; r: number | null }>('select id, ranking_pat as r from cuvee where producteur_id = $1', [producteurId]))
    .map((c) => [c.id, c.r]));
  const nouvelles = new Map<string, number | null>();
  for (const { vinId: id, ranking } of saisies) {
    if (!actuelles.has(id) || !(ranking === null || (Number.isInteger(ranking) && ranking >= 0 && ranking <= 5))) continue;
    if (ranking !== (actuelles.get(id) ?? null)) nouvelles.set(id, ranking);
  }
  for (const [id, r] of nouvelles) await requete('update cuvee set ranking_pat = $2 where id = $1 and producteur_id = $3', [id, r, producteurId]);
}

/** Ranking d'un producteur (liste des producteurs) ou d'un terroir. */
export async function changerRanking(type: 'producteur' | 'terroir', id: string, f: FormData) {
  await exigerAdmin();
  const rk = entier(f, 'ranking');
  const retour = txt(f, 'retour') ?? '/admin/super/producteurs';
  if (rk === null || !(rk >= 0 && rk <= 5)) redirect(retour);
  if (type === 'producteur') {
    await requete('update producteur set ranking_pat = $2, maj_le = now() where id = $1', [id, rk]);
  } else {
    // Le ranking d'un terroir vaut pour tous les vins de ce terroir, dans tous les restaurants.
    await requete('update terroir set ranking_pat = $2, maj_le = now() where id = $1', [id, rk]);
    await requete('update vin_carte set ranking_terroir = $2 where appellation_id = $1', [id, rk]);
  }
  revalidatePath('/admin', 'layout');
  redirect(retour.startsWith('/admin/super/producteurs') ? avec(retour, { ok: 'Ranking enregistré.' }) : retour);
}

const COULEURS_VIN = ['bulles', 'blanc', 'rose', 'rouge', 'orange', 'doux', 'sans_alcool'];

/** « Ajouter un producteur » (menu Producteurs) : créé validé, avec son ranking ; on ouvre ensuite sa fiche pour la compléter. */
export async function ajouterProducteur(f: FormData) {
  const u = await exigerAdmin();
  const liste = '/admin/super/producteurs';
  const nom = txt(f, 'nom');
  const rk = entier(f, 'ranking');
  if (!nom) redirect(avec(liste, { erreur: 'Indiquez le nom du producteur.' }));
  if (rk === null || !(rk >= 0 && rk <= 5)) redirect(avec(liste, { erreur: 'Ranking du producteur : entier de 0 à 5.' }));
  const [deja] = await requete<{ id: string }>(`select id from producteur where lower(nom) = lower($1) and statut <> 'retire' limit 1`, [nom]);
  if (deja) redirect(avec(`/admin/super/producteurs/${encodeURIComponent(deja.id)}`, { erreur: 'Ce producteur est déjà dans la base : voici sa fiche.' }));
  const base = `pat-prod-${slug(nom).slice(0, 60)}`;
  const [{ n }] = await requete<{ n: number }>(`select count(*)::int as n from producteur where id = $1 or id like $1 || '-%'`, [base]);
  const id = n ? `${base}-${n + 1}` : base;
  await requete(
    `insert into producteur (id, nom, pays, region, ranking_pat, statut, source, valide_par, valide_le)
     values ($1, $2, $3, $4, $5, 'valide', 'super-admin', $6, now())`,
    [id, nom, txt(f, 'pays'), txt(f, 'region'), rk, u.email]);
  revalidatePath('/admin', 'layout');
  redirect(avec(`/admin/super/producteurs/${encodeURIComponent(id)}`, { ok: 'Producteur ajouté à la base. Complétez sa fiche si besoin.' }));
}

/** « Ajouter un vin » (menu Vins de la base) : un vin validé d'un producteur de la base ; on ouvre ensuite sa fiche (étiquette, garde…). */
export async function ajouterVinBase(f: FormData) {
  await exigerAdmin();
  const liste = '/admin/super/vins';
  const nomProducteur = txt(f, 'producteur');
  const nom = txt(f, 'nom');
  const couleur = txt(f, 'couleur');
  const rk = entier(f, 'ranking');
  if (!nom || !nomProducteur) redirect(avec(liste, { erreur: 'Indiquez le producteur et le nom du vin.' }));
  if (!couleur || !COULEURS_VIN.includes(couleur)) redirect(avec(liste, { erreur: 'Choisissez la couleur du vin.' }));
  if (rk !== null && !(rk >= 0 && rk <= 5)) redirect(avec(liste, { erreur: 'Note du vin : entier de 0 à 5 (ou vide : celle du producteur).' }));
  // Le producteur choisi dans la liste (« Nom · Région ») ou tapé à l'identique.
  const [p] = await requete<{ id: string }>(
    `select id from producteur where statut <> 'retire' and (lower(nom) = lower($1) or lower(nom || ' · ' || coalesce(region, '')) = lower($1))
      order by statut = 'valide' desc limit 1`, [nomProducteur]);
  if (!p) redirect(avec(liste, { erreur: `Producteur « ${nomProducteur} » introuvable : ajoutez-le d’abord dans le menu Producteurs.` }));
  const id = `${p.id}-cuv-${slug(nom)}`.slice(0, 160);
  const [deja] = await requete<{ id: string }>('select id from cuvee where id = $1', [id]);
  if (deja) redirect(avec(`/admin/super/vins/${encodeURIComponent(id)}`, { erreur: 'Ce vin est déjà dans la base : voici sa fiche.' }));
  // Appellation gardée telle que saisie, reliée à l'appellation de la base du même nom quand elle existe.
  const appellation = txt(f, 'appellation');
  const cleT = (s: string) => appellationCourte(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const terroir = appellation
    ? (await requete<{ id: string; nom: string }>(`select id, nom from terroir where statut <> 'retire'`)).find((x) => cleT(x.nom) === cleT(appellation))?.id ?? null
    : null;
  await requete(
    `insert into cuvee (id, producteur_id, nom, couleur, cepages, appellation_texte, appellation_id, ranking_pat, statut, source)
     values ($1, $2, $3, $4::couleur_vin, $5, $6, $7, $8, 'valide', 'super-admin')`,
    [id, p.id, nom, couleur, txt(f, 'cepages'), appellation, terroir, rk]);
  revalidatePath('/admin', 'layout');
  redirect(avec(`/admin/super/vins/${encodeURIComponent(id)}`, { ok: 'Vin ajouté à la base. Ajoutez son étiquette et complétez sa fiche si besoin.' }));
}

// ───────── Vins de la base (cuvées) ─────────
/**
 * Fiche d'un vin de la base : nom, couleur, appellation (reliée au terroir du même nom), cépages, garde, description,
 * étiquette (reprise par les vins des cartes qui n'ont pas leur propre photo) ; Enregistrer, Valider ou Retirer.
 */
export async function enregistrerCuvee(id: string, f: FormData) {
  await exigerAdmin();
  const page = `/admin/super/vins/${encodeURIComponent(id)}`;
  const [c] = await requete<{ etiquette_url: string | null; appellation_id: string | null; appellation: string | null; producteur_id: string; producteur: string }>(
    `select c.etiquette_url, c.appellation_id, coalesce(c.appellation_texte, t.nom) as appellation, c.producteur_id, p.nom as producteur
       from cuvee c join producteur p on p.id = c.producteur_id left join terroir t on t.id = c.appellation_id where c.id = $1`, [id]);
  if (!c) redirect('/admin/super/vins');
  // Producteur changé : le vin est rattaché au producteur de la base de ce nom (choisi dans la liste), sinon rien n'est enregistré.
  const cleP = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const nomProducteur = txt(f, 'producteur');
  let nouveauProducteur: { id: string; nom: string; ranking_pat: number | null } | null = null;
  if (nomProducteur && cleP(nomProducteur) !== cleP(c.producteur)) {
    const candidats = await requete<{ id: string; nom: string; ranking_pat: number | null }>(
      `select id, nom, ranking_pat from producteur where statut <> 'retire' order by statut = 'valide' desc, nom`);
    nouveauProducteur = candidats.find((p) => cleP(p.nom) === cleP(nomProducteur)) ?? null;
    if (!nouveauProducteur) {
      redirect(avec(page, { erreur: `Producteur « ${nomProducteur} » introuvable dans la base : choisissez un nom dans la liste (rien n'a été enregistré).` }));
    }
  }
  const decision = txt(f, 'decision');
  const couleur = txt(f, 'couleur');
  // Appellation : toujours gardée telle que saisie ; reliée à l'appellation de la base du même nom
  // (accents, tirets, casse et « AOC » à part). Inchangée : le lien existant est gardé.
  const appellation = txt(f, 'appellation');
  const cleT = (s: string) => appellationCourte(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let terroir: string | null = null;
  if (appellation && c.appellation && cleT(appellation) === cleT(c.appellation)) terroir = c.appellation_id;
  else if (appellation) {
    const candidats = await requete<{ id: string; nom: string }>(`select id, nom from terroir where statut <> 'retire'`);
    terroir = candidats.find((x) => cleT(x.nom) === cleT(appellation))?.id ?? null;
  }
  let etiquette: string | null = null;
  const image = f.get('etiquette');
  if (image instanceof File && image.size > 0) {
    try { etiquette = await deposerImage(image, 'base/etiquettes'); } catch (e) { redirect(avec(page, { erreur: (e as Error).message })); }
  }
  const retirerEtiquette = !etiquette && f.get('retirer_etiquette') === 'on';
  // Note du vin (cuisine interne) : vide = celle du producteur ; une valeur hors 0 à 5 est ignorée.
  const rv = entier(f, 'ranking_vin');
  const noteVin = rv !== null && Number.isInteger(rv) && rv >= 0 && rv <= 5 ? rv : null;
  if (f.has('ranking_vin')) await requete('update cuvee set ranking_pat = $2 where id = $1', [id, noteVin]);
  // Nature, bio (cases de la fiche ; « Retirer de la base » envoie aussi le formulaire, sans changer le sens des cases).
  await requete('update cuvee set nature = $2, bio = $3 where id = $1', [id, f.get('nature') === 'on', f.get('bio') === 'on']);
  await requete(
    `update cuvee set nom = coalesce($2, nom), couleur = $3::couleur_vin, appellation_id = $4, appellation_texte = $11, cepages = $5, garde = $6, description = $7,
            statut = case $8 when 'valider' then 'valide'::statut_validation when 'retirer' then 'retire'::statut_validation else statut end,
            etiquette_url = case when $9::text is not null then $9 when $10 then null else etiquette_url end,
            etiquette_source = case when $9::text is not null then 'fichier' when $10 then null else etiquette_source end,
            etiquette_maj_le = case when $9::text is not null or $10 then now() else etiquette_maj_le end
      where id = $1`,
    [id, txt(f, 'nom'), couleur && ['bulles', 'blanc', 'rose', 'rouge', 'orange', 'doux', 'sans_alcool'].includes(couleur) ? couleur : null, terroir,
      txt(f, 'cepages'), txt(f, 'garde'), txt(f, 'description'), decision, etiquette, retirerEtiquette, appellation]);
  // Nouveau producteur : la cuvée et ses vins sur les cartes y sont rattachés (avec le ranking de ce producteur).
  if (nouveauProducteur) {
    await requete('update cuvee set producteur_id = $2 where id = $1', [id, nouveauProducteur.id]);
    await requete(
      `update vin_carte set producteur_id = $2, producteur_texte = $3, ranking_producteur = coalesce($4, ranking_producteur) where cuvee_id = $1`,
      [id, nouveauProducteur.id, nouveauProducteur.nom, nouveauProducteur.ranking_pat]);
  }
  // Appellation de la base : reportée sur les vins des cartes reliés que le restaurant n'a jamais modifiés dans son espace
  // (l'appellation y vient alors de la lecture de la carte) ou qui n'en ont pas.
  if (appellation) {
    await requete(`update vin_carte set appellation_texte = $2, appellation_id = coalesce($3, appellation_id)
                    where cuvee_id = $1 and (appellation_texte is null or modifie_bo is null)`,
      [id, appellation, terroir]);
  }
  // Cépages de la base : reportés sur les vins des cartes reliés qui n'en ont pas (jamais sur ceux saisis par un restaurant).
  if (txt(f, 'cepages')) {
    await requete(`update vin_carte set cepages = $2 where cuvee_id = $1 and coalesce(cepages, '') = ''`, [id, txt(f, 'cepages')]);
  }
  // Couleur changée dans la base : les vins des cartes reliés changent de catégorie aussi (la carte de l'app suit).
  if (couleur && ['bulles', 'blanc', 'rose', 'rouge', 'orange', 'doux', 'sans_alcool'].includes(couleur)) {
    await requete('update vin_carte set couleur = $2::couleur_vin where cuvee_id = $1 and couleur::text <> $2', [id, couleur]);
  }
  // Étiquette de la cuvée : reprise par les vins des cartes reliés qui n'ont pas leur propre photo ; retirée de ceux qui l'avaient reprise.
  if (etiquette) {
    await requete(
      `update vin_carte set etiquette_url = $2, etiquette_source = 'cuvee', etiquette_statut = 'trouvee'
        where cuvee_id = $1 and (etiquette_url is null or etiquette_source = 'cuvee')`, [id, etiquette]);
  } else if (retirerEtiquette) {
    await requete(`update vin_carte set etiquette_url = null, etiquette_source = null where cuvee_id = $1 and etiquette_source = 'cuvee'`, [id]);
  }
  revalidatePath('/', 'layout');
  // Retour sur la liste d'où l'on venait (mêmes filtres, même page), la ligne du vin centrée et mise en évidence.
  const liste = txt(f, 'retour');
  const base = liste?.startsWith('/admin/super/vins') ? liste : '/admin/super/vins';
  const [{ nom } = { nom: 'Vin' }] = await requete<{ nom: string }>('select nom from cuvee where id = $1', [id]);
  const fait = decision === 'valider' ? 'validé' : decision === 'retirer' ? 'retiré de la base' : 'enregistré';
  const lien = appellation && !terroir ? ' (appellation absente de la base : gardée sans lien)' : '';
  redirect(`${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams({ vin: id, ok: `« ${nom} » ${fait}${lien}.` })}`);
}

/**
 * Doublon dans la base : ce vin est fusionné dans un autre (le vin gardé). Les vins des cartes et les demandes d'étiquette
 * passent sur le vin gardé, qui reprend ce qui lui manque (couleur, appellation, cépages, garde, description, étiquette) ;
 * le doublon est retiré de la base (rien n'est supprimé). On ouvre la fiche du vin gardé.
 */
export async function fusionnerCuvee(id: string, f: FormData) {
  await exigerAdmin();
  const cible = txt(f, 'cible');
  const retour = txt(f, 'retour');
  const liste = retour?.startsWith('/admin/super/vins') ? retour : '/admin/super/vins';
  const page = `/admin/super/vins/${encodeURIComponent(id)}`;
  if (!cible || cible === id) redirect(avec(page, { retour: liste, erreur: 'Choisissez le vin à garder.' }));
  const [a, b] = await Promise.all([
    requete<{ nom: string }>('select nom from cuvee where id = $1', [id]),
    requete<{ nom: string }>(`select nom from cuvee where id = $1 and statut <> 'retire'`, [cible])]);
  if (!a[0] || !b[0]) redirect(avec(page, { retour: liste, erreur: 'Vin introuvable dans la base.' }));
  await requete(
    `update cuvee k set couleur = coalesce(k.couleur, d.couleur), appellation_id = coalesce(k.appellation_id, d.appellation_id),
            appellation_texte = coalesce(k.appellation_texte, case when k.appellation_id is null then d.appellation_texte end),
            cepages = coalesce(nullif(k.cepages, ''), d.cepages), garde = coalesce(nullif(k.garde, ''), d.garde),
            description = coalesce(nullif(k.description, ''), d.description),
            etiquette_url = coalesce(k.etiquette_url, d.etiquette_url), etiquette_source = case when k.etiquette_url is null then d.etiquette_source else k.etiquette_source end,
            etiquette_maj_le = case when k.etiquette_url is null and d.etiquette_url is not null then now() else k.etiquette_maj_le end
       from cuvee d where k.id = $1 and d.id = $2`, [cible, id]);
  await requete('update vin_carte set cuvee_id = $2 where cuvee_id = $1', [id, cible]);
  await requete('update demande_etiquette set cuvee_id = $2 where cuvee_id = $1', [id, cible]);
  // Étiquette reprise de la base par les vins des cartes : désormais celle du vin gardé.
  await requete(
    `update vin_carte v set etiquette_url = k.etiquette_url from cuvee k
      where k.id = $1 and v.cuvee_id = $1 and v.etiquette_source = 'cuvee' and k.etiquette_url is not null`, [cible]);
  await requete(`update cuvee set statut = 'retire' where id = $1`, [id]);
  revalidatePath('/', 'layout');
  redirect(`/admin/super/vins/${encodeURIComponent(cible)}?${new URLSearchParams({ retour: liste, ok: `« ${a[0].nom} » fusionné dans ce vin : ses vins sur les cartes y sont maintenant reliés.` })}`);
}

/** Plusieurs vins à valider cochés dans la liste « Vins de la base » : validés ensemble, retour sur la même liste. */
export async function validerCuvees(f: FormData) {
  await exigerAdmin();
  const ids = f.getAll('ids').map(String).filter(Boolean);
  const valides = ids.length
    ? await requete<{ id: string }>(`update cuvee set statut = 'valide' where id = any($1) and statut = 'propose' returning id`, [ids])
    : [];
  revalidatePath('/', 'layout');
  const liste = txt(f, 'retour');
  const base = liste?.startsWith('/admin/super/vins') ? liste : '/admin/super/vins';
  const ok = valides.length ? `${valides.length} vin${valides.length > 1 ? 's' : ''} validé${valides.length > 1 ? 's' : ''}.` : 'Aucun vin à valider dans la sélection.';
  redirect(`${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams({ vin: valides[0]?.id ?? ids[0] ?? '', ok })}`);
}

/**
 * Vin d'une carte pas encore dans la base : ajouté à la base de Pat (à valider), à partir de la carte
 * (nom du vin, couleur, appellation, cépages, étiquette), et relié au vin de la carte. On ouvre sa fiche.
 */
export async function ajouterCuveeDepuisCarte(vinId: string, f: FormData) {
  await exigerAdmin();
  const retour = txt(f, 'retour') ?? '/admin/super/vins';
  const [v] = await requete<{ producteur_id: string | null; libelle: string; nom_vin: string | null; couleur: string; cepages: string | null;
    appellation_id: string | null; appellation_texte: string | null; etiquette_url: string | null; cuvee_id: string | null }>(
    `select producteur_id, libelle, nom_vin, couleur::text, cepages, appellation_id, appellation_texte, etiquette_url, cuvee_id from vin_carte where id = $1`, [vinId]);
  if (!v || !v.producteur_id) redirect(retour);
  let id = v.cuvee_id;
  if (!id) {
    id = `carte-${v.producteur_id}-${v.libelle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 120);
    await requete(
      `insert into cuvee (id, producteur_id, nom, couleur, cepages, appellation_id, appellation_texte, etiquette_url, etiquette_source, statut, source)
       values ($1, $2, $3, $4::couleur_vin, $5, $6, $7, $8, case when $8::text is not null then 'restaurant' end, 'propose', 'carte')
       on conflict (id) do nothing`,
      [id, v.producteur_id, v.nom_vin || v.libelle, v.couleur, v.cepages, v.appellation_id, v.appellation_texte, v.etiquette_url]);
    // Toutes les contenances de ce vin sur la carte (verre, bouteille, magnum…) sont reliées au même vin de la base.
    const lignes = await requete<{ id: string; couleur: string; libelle: string; millesime: string | null; format: string; cuvee_id: string | null }>(
      'select id, couleur::text, libelle, millesime, format, cuvee_id from vin_carte where restaurant_id = (select restaurant_id from vin_carte where id = $1) order by ordre, id', [vinId]);
    const memes = (grouperMemeVin(lignes, (l) => l.format).find((g) => g.some((l) => l.id === vinId)) ?? []).filter((l) => l.id === vinId || !l.cuvee_id).map((l) => l.id);
    await requete('update vin_carte set cuvee_id = $2 where id = any($1)', [memes.length ? memes : [vinId], id]);
  }
  redirect(`/admin/super/vins/${encodeURIComponent(id)}?${new URLSearchParams({ retour })}`);
}

// ───────── Principes ─────────
export async function verifierImportPrincipes(f: FormData) {
  const u = await exigerAdmin();
  const fichier = f.get('fichier');
  if (!(fichier instanceof File) || !fichier.size) redirect(avec('/admin/super/principes', { erreur: 'Choisissez un fichier .xlsx ou .json.' }));
  const contenu = Buffer.from(await (fichier as File).arrayBuffer());
  const r = await importerVersion(requete, { nomFichier: (fichier as File).name, contenu, par: u.email, simulation: true });
  await requete(`delete from principes_import where cree_le < now() - interval '1 day'`);
  const [imp] = await requete<{ id: string }>(
    `insert into principes_import (nom_fichier, contenu, resultat, par) values ($1, $2, $3, $4) returning id`,
    [(fichier as File).name, contenu, JSON.stringify(r), u.email]);
  redirect(avec('/admin/super/principes', { import: imp.id }));
}

export async function creerBrouillonPrincipes(importId: string, f: FormData) {
  const u = await exigerAdmin();
  const [imp] = await requete<{ nom_fichier: string; contenu: Buffer }>('select nom_fichier, contenu from principes_import where id = $1', [importId]);
  if (!imp) redirect(avec('/admin/super/principes', { erreur: 'Import expiré : renvoyez le fichier.' }));
  const r = await importerVersion(requete, { nomFichier: imp.nom_fichier, contenu: imp.contenu, par: u.email, remplacerBrouillon: f.get('remplacer') === 'on' });
  if (r.erreurs.length) redirect(avec('/admin/super/principes', { import: importId, erreur: r.erreurs.join(' ') }));
  await requete('delete from principes_import where id = $1', [importId]);
  revalidatePath('/admin/super', 'layout');
  redirect(avec('/admin/super/principes', { ok: `Brouillon ${r.code} créé à partir de ${imp.nom_fichier}.` }));
}

export async function modifierPrincipe(n: number, f: FormData) {
  await exigerAdmin();
  const tags = (txt(f, 'tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const r = await modifierPrincipeBrouillon(requete, n, { titre: txt(f, 'titre') ?? '', regle: txt(f, 'regle') ?? '', tags, aRelire: f.get('relu') !== 'on' });
  revalidatePath('/admin/super/principes');
  const msg: Record<string, string> = r.erreurs.length ? { erreur: `Enregistré, mais le brouillon a des erreurs : ${r.erreurs.join(' ')}` } : { ok: `Principe n°${n} enregistré.` };
  redirect(avec('/admin/super/principes', { ...msg, n: String(n) }) + `#p${n}`);
}

// ───────── Règles par défaut ─────────
export async function enregistrerReglesDefaut(f: FormData) {
  await exigerAdmin();
  const p: Reglages = { ...REGLAGES_PAT };
  for (const k of Object.keys(REGLAGES_PAT) as (keyof Reglages)[]) {
    if (typeof REGLAGES_PAT[k] === 'boolean') (p[k] as boolean) = f.get(k) === 'on';
    else { const v = Number(String(f.get(k) ?? '').replace(',', '.')); (p[k] as number) = Number.isFinite(v) ? v : (REGLAGES_PAT[k] as number); }
  }
  const r = await enregistrerBrouillonRegles(requete, parametresRegles(p), txt(f, 'notes'));
  revalidatePath('/admin/super/regles');
  redirect(avec('/admin/super/regles', r.erreurs.length ? { erreur: r.erreurs.join(' ') } : { ok: `Brouillon ${r.code} enregistré.` }));
}

// ───────── Publication ─────────
async function lancerPreparation() {
  const appels = await Promise.all(Array.from({ length: PLATS_EN_PARALLELE }, async () =>
    fetch(`${await origine()}/.netlify/functions/preparer-publication-background`, { method: 'POST' }).then((r) => r.status).catch(() => 0)));
  if (!appels.some((s) => s === 202 || s === 200)) {
    // Hors Netlify (développement local) : le serveur traite la file lui-même, sans faire attendre la page.
    void travaillerPublications(requete, { finAvant: Date.now() + 60 * 60 * 1000 }).catch((e) => console.error('[publication]', e));
  }
}

export async function preparer(type: TypePublication) {
  const u = await exigerAdmin();
  const page = type === 'principes' ? '/admin/super/principes' : '/admin/super/regles';
  if (type === 'principes' && !process.env.ANTHROPIC_API_KEY) redirect(avec(page, { erreur: 'Clé Claude absente : ANTHROPIC_API_KEY n’est pas configurée.' }));
  const r = await preparerPublication(requete, type, u.email);
  if (r.erreurs.length) redirect(avec(page, { erreur: r.erreurs.join(' ') }));
  if (type === 'principes') await lancerPreparation();
  redirect(`/admin/super/publications/${r.publicationId}`);
}

export async function confirmer(id: string) {
  const u = await exigerAdmin();
  const r = await confirmerPublication(requete, id, u.email);
  revalidatePath('/', 'layout');
  redirect(avec(`/admin/super/publications/${id}`, r.erreurs.length ? { erreur: r.erreurs.join(' ') } : { ok: `Version ${r.code} en service.` }));
}

export async function annuler(id: string) {
  await exigerAdmin();
  await annulerPublication(requete, id);
  redirect(`/admin/super/publications/${id}`);
}

export async function relancer(id: string) {
  await exigerAdmin();
  if (await relancerEchecs(requete, id)) await lancerPreparation();
  redirect(`/admin/super/publications/${id}`);
}

// ───────── Wine Labs (étiquettes) ─────────
type Endpoint = { id: string; url: string; active?: boolean };
const adresseWebhook = async () => `${await origine()}/api/webhooks/wine-labs`;

/** Enregistre notre adresse de webhook chez Wine Labs ; le secret (montré une seule fois) est gardé côté serveur. */
export async function brancherWebhookWineLabs() {
  await exigerAdmin();
  const url = await adresseWebhook();
  try {
    // Déjà enregistrée (409) : on la retire puis on la réenregistre, pour obtenir un secret que nous connaissons.
    const { endpoints = [] } = await appelerWineLabs<{ endpoints?: Endpoint[] }>('GET', '/wine_labels/webhooks')
      .catch(() => ({ endpoints: [] as Endpoint[] })); // liste illisible : on tente quand même l'enregistrement
    for (const e of endpoints.filter((x) => x.url === url)) await appelerWineLabs('DELETE', `/wine_labels/webhooks/${e.id}`);
    const r = await appelerWineLabs<{ secret?: string }>('POST', '/wine_labels/webhooks', { url, description: 'Pat le sommelier' });
    if (!r.secret) throw new Error('Wine Labs n’a pas renvoyé de secret.');
    await requete(`insert into reglage_serveur (cle, valeur) values ('wine_labs_webhook_secret', $1)
                   on conflict (cle) do update set valeur = excluded.valeur, maj_le = now()`, [r.secret]);
  } catch (e) {
    redirect(avec('/admin/super/wine-labs', { erreur: (e as Error).message }));
  }
  redirect(avec('/admin/super/wine-labs', { ok: 'Webhook branché. Envoyez un test pour vérifier.' }));
}

export async function testerWebhookWineLabs(endpointId: string) {
  await exigerAdmin();
  let message: Record<string, string>;
  try {
    const r = await appelerWineLabs<{ ok?: boolean; status_code?: number; error?: string }>('POST', `/wine_labels/webhooks/${encodeURIComponent(endpointId)}/test`, {});
    message = r.ok ? { ok: 'Test reçu par le site : le webhook fonctionne.' } : { erreur: `Test refusé (${r.status_code ?? '?'}) ${r.error ?? ''}`.trim() };
  } catch (e) {
    message = { erreur: (e as Error).message };
  }
  redirect(avec('/admin/super/wine-labs', message));
}

// ───────── Prix des plats relus sur le menu ─────────
/** Le super-admin envoie le menu d'un restaurant : Pat en relit les prix en arrière-plan (plats et accords inchangés). */
export async function relirePrixMenu(resto: string, form: FormData): Promise<{ erreurs: string[] }> {
  const u = await exigerAdmin();
  const brut = form.getAll('fichiers').filter((f): f is File => f instanceof File && f.size > 0);
  const lus = await Promise.all(brut.map(async (f) => ({ nom: f.name.slice(0, 120), octets: new Uint8Array(await f.arrayBuffer()) })));
  const erreurs = verifierFichiers('menu', lus);
  if (erreurs.length) return { erreurs };
  const [en] = await requete<{ n: number }>(`select count(*)::int as n from relecture_prix where restaurant_id = $1 and statut in ('en_attente', 'en_cours')`, [resto]);
  if (en.n) return { erreurs: ['Une relecture est déjà en cours pour ce restaurant.'] };
  const [r] = await requete<{ id: string }>('insert into relecture_prix (restaurant_id, demande_par) values ($1, $2) returning id', [resto, u.email]);
  for (const f of lus) {
    await requete('insert into relecture_prix_fichier (relecture_id, nom, media_type, octets) values ($1, $2, $3, $4)',
      [r.id, f.nom, typeReel(f.octets), Buffer.from(f.octets)]);
  }
  const statut = await fetch(`${await origine()}/.netlify/functions/relire-prix-background`, { method: 'POST' }).then((x) => x.status).catch(() => 0);
  if (statut !== 202 && statut !== 200) void traiterRelecturesPrix(requete, { finAvant: Date.now() + 15 * 60 * 1000 }).catch((e) => console.error('[prix]', e));
  revalidatePath(`/admin/${resto}/menu`);
  return { erreurs: [] };
}

// ───────── Comparaison de modèles Claude ─────────
/** Lance la comparaison de deux modèles sur 1 à 3 plats d'un restaurant (en arrière-plan ; rien n'est enregistré dans les accords). */
export async function lancerComparaison(f: FormData) {
  const u = await exigerAdmin();
  const resto = txt(f, 'restaurant');
  const plats = f.getAll('plats').map(String).filter(Boolean).slice(0, 3);
  const modeles = [txt(f, 'modele_a') ?? 'claude-sonnet-5-5', txt(f, 'modele_b') ?? 'claude-opus-5-5'];
  if (!resto || !plats.length) redirect(avec('/admin/super/comparaison', { ...(resto ? { resto } : {}), erreur: 'Choisissez au moins un plat.' }));
  const [c] = await requete<{ id: string }>(
    'insert into comparaison_modeles (restaurant_id, plats, modeles, demande_par) values ($1, $2, $3, $4) returning id', [resto, plats, modeles, u.email]);
  const statut = await fetch(`${await origine()}/.netlify/functions/comparer-modeles-background`, { method: 'POST' }).then((r) => r.status).catch(() => 0);
  if (statut !== 202 && statut !== 200) {
    // Hors Netlify (développement local) : le serveur fait la comparaison lui-même, sans faire attendre la page.
    const pg = (await import('pg')).default;
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: /localhost|127\.0\.0\.1|host=\/tmp/.test(process.env.DATABASE_URL ?? '') ? false : { rejectUnauthorized: false } });
    void traiterComparaisons(pool, { finAvant: Date.now() + 15 * 60 * 1000 }).catch((e) => console.error('[comparaison]', e)).finally(() => pool.end());
  }
  redirect(avec('/admin/super/comparaison', { resto: resto!, id: c.id }));
}
