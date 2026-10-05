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
import { preparerAccords } from '@/lib/inscription/adaptateurs';
import { importerVersion, modifierPrincipeBrouillon } from '@/lib/principes/versions';
import { validerProducteur, rejeterProducteur } from '@/lib/producteurs/validation';
import { annulerPublication, confirmerPublication, preparerPublication, relancerEchecs, travaillerPublications, type TypePublication } from '@/lib/publication/publication';
import { enregistrerBrouillonRegles } from '@/lib/regles/versions';
import { appelerWineLabs } from '@/lib/etiquettes/wine-labs';
import { parametresRegles, REGLAGES_PAT, type Reglages } from '@/lib/selection';

const txt = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
const avec = (url: string, params: Record<string, string>) => `${url}?${new URLSearchParams(params)}`;
const entier = (f: FormData, k: string) => { const v = txt(f, k); return v === null ? null : Number.isInteger(Number(v)) ? Number(v) : NaN; };

async function origine() {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}

// ───────── « Ouvrir en tant que… » ─────────
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
  const couleur = /^#[0-9a-f]{6}$/i.test(txt(f, 'couleur') ?? '') ? txt(f, 'couleur')! : '#610420';
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
    if (k.startsWith('rkv_')) vins.push({ vinId: k.slice(4), ranking: v.trim() === '' ? null : Number(v) });
  }
  return { terroirs, vins };
}

/** « Valider » depuis la file, sans ouvrir la fiche : ranking saisi (suggestion de Pat par défaut), rankings des cuvées gardés. */
export async function validerDepuisListe(producteurId: string, f: FormData) {
  const u = await exigerAdmin();
  const r = await validerProducteur(requete, { producteurId, rankingProducteur: entier(f, 'ranking') ?? NaN, par: u.email });
  revalidatePath('/admin', 'layout');
  redirect(avec('/admin/super/producteurs', r.erreurs.length
    ? { erreur: r.erreurs.join(' ') }
    : { ok: `Producteur validé : ${r.vins} vin(s) de carte passent « Déjà référencé »${r.restaurants.length ? ` (${r.restaurants.join(', ')})` : ''}.` }));
}

export async function decisionProducteur(producteurId: string, f: FormData) {
  const u = await exigerAdmin();
  const page = `/admin/super/producteurs/${encodeURIComponent(producteurId)}`;
  const decision = txt(f, 'decision');
  if (decision === 'rejeter') {
    await rejeterProducteur(requete, { producteurId, motif: txt(f, 'motif') ?? '', par: u.email });
    revalidatePath('/admin', 'layout');
    redirect(avec('/admin/super/producteurs', { ok: 'Producteur rejeté : ses vins restent « Nouveau producteur ».' }));
  }
  const fiche = { nom: txt(f, 'nom') ?? undefined, pays: txt(f, 'pays'), region: txt(f, 'region'), notes_objectives: txt(f, 'notes_objectives') };
  const { terroirs, vins } = lireRankings(f);
  const rk = entier(f, 'ranking');
  if (decision === 'valider') {
    const r = await validerProducteur(requete, { producteurId, rankingProducteur: rk ?? NaN, terroirs, vins, fiche, par: u.email });
    if (r.erreurs.length) redirect(avec(page, { erreur: r.erreurs.join(' ') }));
    revalidatePath('/admin', 'layout');
    redirect(avec('/admin/super/producteurs', { ok: `Producteur validé : ${r.vins} vin(s) de carte passent « Déjà référencé »${r.restaurants.length ? ` (${r.restaurants.join(', ')})` : ''}.` }));
  }
  // Enregistrer sans valider : fiche et rankings (le producteur reste à valider).
  if (rk !== null && !(rk >= 0 && rk <= 5)) redirect(avec(page, { erreur: 'Ranking du producteur : entier de 0 à 5.' }));
  await requete(
    `update producteur set nom = coalesce($2, nom), pays = $3, region = $4, notes_objectives = $5, ranking_suggere = coalesce($6, ranking_suggere), maj_le = now() where id = $1`,
    [producteurId, fiche.nom ?? null, fiche.pays, fiche.region, fiche.notes_objectives, rk]);
  for (const t of terroirs) if (t.rankingTerroir >= 0 && t.rankingTerroir <= 5) await requete('update terroir set ranking_pat = $2, maj_le = now() where id = $1', [t.terroirId, t.rankingTerroir]);
  for (const v of vins) if (v.ranking === null || (v.ranking >= 0 && v.ranking <= 5)) await requete('update vin_carte set ranking_producteur = $2 where id = $1 and producteur_id = $3', [v.vinId, v.ranking, producteurId]);
  revalidatePath(page);
  redirect(avec(page, { ok: 'Fiche enregistrée (producteur toujours à valider).' }));
}

/** Ranking d'un producteur ou d'un terroir déjà validé (écran « Base et rankings »). */
export async function changerRanking(type: 'producteur' | 'terroir', id: string, f: FormData) {
  await exigerAdmin();
  const rk = entier(f, 'ranking');
  const retour = txt(f, 'retour') ?? '/admin/super/base';
  if (rk === null || !(rk >= 0 && rk <= 5)) redirect(retour);
  if (type === 'producteur') {
    await requete('update producteur set ranking_pat = $2, maj_le = now() where id = $1', [id, rk]);
  } else {
    // Le ranking d'un terroir vaut pour tous les vins de ce terroir, dans tous les restaurants.
    await requete('update terroir set ranking_pat = $2, maj_le = now() where id = $1', [id, rk]);
    await requete('update vin_carte set ranking_terroir = $2 where appellation_id = $1', [id, rk]);
  }
  revalidatePath('/admin', 'layout');
  redirect(retour);
}

/** « Ajouter un vin » à un producteur de la base (cuvée sans millésime). */
export async function ajouterCuvee(producteurId: string, f: FormData) {
  await exigerAdmin();
  const nom = txt(f, 'nom');
  const retour = txt(f, 'retour') ?? '/admin/super/base';
  const couleur = txt(f, 'couleur');
  if (nom) {
    const id = `${producteurId}-cuv-${nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    await requete(
      `insert into cuvee (id, producteur_id, nom, couleur, cepages, statut) values ($1, $2, $3, $4::couleur_vin, $5, 'valide')
       on conflict (id) do update set nom = excluded.nom, couleur = excluded.couleur, cepages = excluded.cepages`,
      [id, producteurId, nom, couleur && ['bulles', 'blanc', 'rose', 'rouge', 'orange', 'doux'].includes(couleur) ? couleur : null, txt(f, 'cepages')]);
  }
  redirect(retour);
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
  const appels = await Promise.all(Array.from({ length: 3 }, async () =>
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
