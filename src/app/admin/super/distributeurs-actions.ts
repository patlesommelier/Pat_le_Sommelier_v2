'use server';
// Super-admin — distributeurs de Quid Vinum : coordonnées, marge, tarif (PDF lu par Claude), vins et prix.
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { enregistrerCoordonneesQv } from '@/lib/distributeurs/donnees';
import { lireTarif, TYPE_DOCX } from '@/lib/distributeurs/lecture';
import { completerVinsDistributeur } from '@/lib/distributeurs/completer';
import { ajouterCuveesManquantes, ajouterProducteurBase, relierProducteur } from '@/lib/distributeurs/rattachement';
import { getProducteursDistributeur } from '@/lib/distributeurs/donnees';
import { cleVin, contenanceTarif } from '@/lib/distributeurs/tarif';
import { typeReel } from '@/lib/inscription/fichiers';
import { deposerImage } from '@/lib/admin/fichiers';

type Retour = { ok?: string; erreur?: string };
const txt = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
/** Nombre (virgule ou point) ; vide : null ; illisible : undefined. */
const nombre = (f: FormData, k: string): number | null | undefined => {
  const v = txt(f, k);
  if (v === null) return null;
  const n = Number(v.replace(/\s|€|%/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : undefined;
};
const page = (id: string) => `/admin/super/distributeurs/${id}`;
const rafraichir = (id?: string) => { revalidatePath('/admin/super/distributeurs'); if (id) revalidatePath(page(id)); };
const TARIF_MAX = 20 * 1024 * 1024;

export async function creerDistributeur(f: FormData) {
  await exigerAdmin();
  const nom = txt(f, 'nom')?.slice(0, 120);
  if (!nom) redirect('/admin/super/distributeurs?erreur=Indiquez%20le%20nom%20du%20distributeur.');
  const [existant] = await requete<{ id: string }>('select id from distributeur where lower(nom) = lower($1)', [nom]);
  const id = existant?.id ?? randomUUID();
  if (!existant) await requete('insert into distributeur (id, nom) values ($1, $2)', [id, nom]);
  rafraichir();
  redirect(page(id));
}

/**
 * Logo dans un format et un poids acceptés par le stockage des images (PNG, JPG, WebP ou SVG, 5 Mo au plus) :
 * un autre format (GIF, AVIF, TIFF…) ou une image trop lourde est converti en PNG, réduit à 800 pixels au plus.
 */
async function logoAccepte(f: File): Promise<File> {
  if (['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(f.type) && f.size <= 4 * 1024 * 1024) return f;
  try {
    const png = await sharp(Buffer.from(await f.arrayBuffer())).rotate().resize(800, 800, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return new File([new Uint8Array(png)], 'logo.png', { type: 'image/png' });
  } catch {
    throw new Error('image illisible ; envoyez-la en PNG ou en JPG.');
  }
}

export async function enregistrerDistributeur(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const nom = txt(f, 'nom')?.slice(0, 120);
  if (!nom) return { erreur: 'Le nom ne peut pas être vide.' };
  const marge = nombre(f, 'marge'), remise = nombre(f, 'remise_qv');
  if (marge == null || marge > 500) return { erreur: 'La marge doit être un pourcentage, par exemple 15.' };
  if (remise === undefined || (remise != null && remise > 100)) return { erreur: 'La remise QV doit être un pourcentage, par exemple 20.' };
  const email = txt(f, 'email');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { erreur: 'L’adresse e-mail ne semble pas valide.' };
  const modele = ['sonnet', 'haiku', 'opus'].includes(txt(f, 'modele_lecture') ?? '') ? txt(f, 'modele_lecture') : 'sonnet';
  const source = txt(f, 'source') === 'api' ? 'api' : 'fichier';
  // Logo : nouvelle image déposée (stockage des images), ou retiré.
  const fichierLogo = f.get('logo');
  let logo: string | null | undefined;
  if (fichierLogo instanceof File && fichierLogo.size) {
    try { logo = await deposerImage(await logoAccepte(fichierLogo), 'distributeurs'); } catch (e) { return { erreur: `Logo non enregistré : ${(e as Error).message}` }; }
  } else if (f.get('retirer_logo') === 'on') logo = null;
  try {
    await requete(`update distributeur set nom = $2, adresse = $3, tva = $4, contact = $5, telephone = $6, email = $7, site = $8, marge = $9, remise_qv = $10,
                   notes = $11, actif = $12, modele_lecture = $13, source = $14, logo_url = case when $15 then $16 else logo_url end where id = $1`,
      [id, nom, txt(f, 'adresse'), txt(f, 'tva'), txt(f, 'contact'), txt(f, 'telephone'), email, txt(f, 'site'), marge, remise, txt(f, 'notes'), f.get('actif') === 'on',
        modele, source, logo !== undefined, logo ?? null]);
  } catch {
    return { erreur: `Un autre distributeur s’appelle déjà « ${nom} ».` };
  }
  // Le nom suit chez les restaurants qui l'ont choisi.
  await requete('update fournisseur set nom = $2 where distributeur_id = $1', [id, nom]);
  rafraichir(id);
  return { ok: 'Distributeur enregistré.' };
}

export async function supprimerDistributeur(id: string) {
  await exigerAdmin();
  await requete('delete from distributeur where id = $1', [id]); // vins et tarifs en cascade ; les fournisseurs des restaurants restent, sans lien
  rafraichir();
  redirect('/admin/super/distributeurs?ok=Distributeur%20supprim%C3%A9.');
}

/** Lance la lecture du tarif (dernier fichier, ou API) en arrière-plan : la page suit l'avancement. */
async function lancerLecture(id: string, depuis: 'fichier' | 'api' = 'fichier') {
  await requete(`update distributeur set lecture_statut = 'en_cours', lecture_message = 'Lecture du tarif…', lecture_le = now() where id = $1`, [id]);
  void lireTarif(requete, id, depuis);
}

/** Type d'un tarif déposé : PDF, Excel (.xlsx), Word (.docx) ou CSV, d'après son contenu et son nom ; null sinon. */
function typeTarif(octets: Uint8Array, nom: string) {
  if (typeReel(octets) === 'application/pdf') return 'application/pdf';
  if (octets[0] === 0x50 && octets[1] === 0x4b && /\.xlsx$/i.test(nom)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (octets[0] === 0x50 && octets[1] === 0x4b && /\.docx$/i.test(nom)) return TYPE_DOCX;
  if (/\.(csv|txt)$/i.test(nom) && !octets.subarray(0, 2000).includes(0)) return 'text/csv';
  return null;
}

/** Nouveau tarif (PDF, Excel, Word ou CSV) : gardé, puis lu ; « ajout » : ses vins s'ajoutent à la liste, aucun n'est retiré. */
export async function deposerTarif(id: string, f: FormData) {
  await exigerAdmin();
  const fichier = f.get('tarif');
  const retour = (m: Record<string, string>) => redirect(`${page(id)}?${new URLSearchParams(m)}`);
  if (!(fichier instanceof File) || !fichier.size) retour({ erreur: 'Choisissez le fichier du tarif (PDF).' });
  const octets = new Uint8Array(await (fichier as File).arrayBuffer());
  if (octets.length > TARIF_MAX) retour({ erreur: 'Fichier trop lourd (20 Mo au maximum).' });
  const nom = (fichier as File).name.slice(0, 160) || 'tarif';
  const type = typeTarif(octets, nom);
  if (!type) retour({ erreur: 'Le tarif doit être un PDF, un fichier Excel (.xlsx), Word (.docx) ou CSV.' });
  await requete('insert into distributeur_tarif (id, distributeur_id, nom, media_type, octets, ajout) values ($1, $2, $3, $4, $5, $6)',
    [randomUUID(), id, nom, type, Buffer.from(octets), f.get('ajout') === 'on']);
  await requete(`update distributeur set source = 'fichier' where id = $1`, [id]);
  await lancerLecture(id);
  rafraichir(id);
  retour({ ok: 'Tarif enregistré : il est en cours de lecture.' });
}

/** Tarif collé depuis le site du distributeur : le texte (lu par Claude) et la version « page web » (pour les étiquettes). */
export async function collerTarif(id: string, f: FormData) {
  await exigerAdmin();
  const texte = String(f.get('texte') ?? '').trim();
  const html = String(f.get('html') ?? '').trim();
  const retour = (m: Record<string, string>) => redirect(`${page(id)}?${new URLSearchParams(m)}`);
  if (texte.length < 40) retour({ erreur: 'Collez d’abord la liste des vins copiée depuis le site du distributeur.' });
  if (texte.length > 2_000_000 || html.length > 15_000_000) retour({ erreur: 'Collage trop long : collez la liste en plusieurs fois.' });
  const date = new Date().toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Brussels' });
  await requete('insert into distributeur_tarif (id, distributeur_id, nom, media_type, octets, html, ajout) values ($1, $2, $3, $4, $5, $6, $7)',
    [randomUUID(), id, `Collage du ${date}`, 'text/plain', Buffer.from(texte, 'utf8'), html || null, f.get('ajout') === 'on']);
  await requete(`update distributeur set source = 'fichier' where id = $1`, [id]);
  await lancerLecture(id);
  rafraichir(id);
  retour({ ok: 'Texte enregistré : il est en cours de lecture.' });
}

export async function relireTarif(id: string): Promise<Retour> {
  await exigerAdmin();
  await lancerLecture(id, 'fichier');
  rafraichir(id);
  return { ok: 'Lecture relancée.' };
}

/**
 * API du distributeur : adresse (https), nom de l'en-tête d'accès et clé. Une clé laissée vide garde celle enregistrée ;
 * « effacer » la retire. La clé n'est jamais renvoyée à la page.
 */
export async function enregistrerApi(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const url = txt(f, 'api_url');
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) return { erreur: 'L’adresse de l’API doit commencer par https://' };
  const entete = txt(f, 'api_entete');
  if (entete && !/^[A-Za-z0-9-]{1,60}$/.test(entete)) return { erreur: 'Nom d’en-tête invalide (ex. Authorization ou X-API-Key).' };
  const cle = txt(f, 'api_cle');
  await requete(`update distributeur set api_url = $2, api_entete = $3, api_cle = case when $5 then null when $4::text is not null then $4 else api_cle end,
                 source = case when $2::text is null then 'fichier' else 'api' end where id = $1`,
    [id, url, entete, cle, f.get('effacer_cle') === 'on']);
  rafraichir(id);
  return { ok: url ? 'API enregistrée : « Lire le tarif depuis l’API » pour l’essayer.' : 'API retirée : le tarif vient des fichiers déposés.' };
}

export async function synchroniserApi(id: string): Promise<Retour> {
  await exigerAdmin();
  const [d] = await requete<{ api_url: string | null }>('select api_url from distributeur where id = $1', [id]);
  if (!d?.api_url) return { erreur: 'Enregistrez d’abord l’adresse de l’API.' };
  await lancerLecture(id, 'api');
  rafraichir(id);
  return { ok: 'Lecture depuis l’API lancée.' };
}

/**
 * Tableau des vins : prix QV (prix_<id>), prix imposé aux restaurants (impose_<id>, vide : prix QV + marge),
 * vin de la base de Pat (cuvee_<id> : une cuvée du producteur, vide : aucune), proposé ou non (actif_<id>).
 */
export async function enregistrerVins(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const ids = [...f.keys()].filter((k) => k.startsWith('prix_')).map((k) => k.slice(5));
  if (!ids.length) return { ok: 'Rien à enregistrer.' };
  const prix = ids.map((v) => nombre(f, `prix_${v}`)), imposes = ids.map((v) => nombre(f, `impose_${v}`));
  const illisibles = ids.filter((_, i) => prix[i] === undefined || imposes[i] === undefined).length;
  const lisibles = (i: number) => prix[i] !== undefined && imposes[i] !== undefined;
  await requete(
    `update distributeur_vin v set prix_qv = x.prix, prix_restaurant = x.impose, actif = x.actif, maj_le = now()
       from unnest($2::text[], $3::numeric[], $4::numeric[], $5::bool[]) as x(id, prix, impose, actif)
      where v.distributeur_id = $1 and v.id = x.id`,
    [id, ids.filter((_, i) => lisibles(i)), prix.filter((_, i) => lisibles(i)), imposes.filter((_, i) => lisibles(i)),
      ids.filter((_, i) => lisibles(i)).map((v) => f.get(`actif_${v}`) === 'on')]);
  // Vin de la base choisi à la main : seulement ceux qui ont changé, et seulement une cuvée du producteur relié.
  const actuels = new Map((await requete<{ id: string; cuvee_id: string | null }>(
    'select id, cuvee_id from distributeur_vin where distributeur_id = $1 and id = any($2)', [id, ids])).map((r) => [r.id, r.cuvee_id ?? '']));
  const changes = ids.filter((v) => f.has(`cuvee_${v}`) && (txt(f, `cuvee_${v}`) ?? '') !== actuels.get(v));
  for (const v of changes) {
    await requete(`update distributeur_vin d set cuvee_id = $3, cuvee_manuel = true
                    where d.distributeur_id = $1 and d.id = $2 and ($3::text is null or exists (select 1 from cuvee c where c.id = $3 and c.producteur_id = d.producteur_id))`,
      [id, v, txt(f, `cuvee_${v}`)]);
  }
  rafraichir(id);
  return illisibles ? { erreur: `Enregistré, sauf ${illisibles} prix illisible${illisibles > 1 ? 's' : ''} (écrivez par exemple 12,50).` } : { ok: 'Vins enregistrés.' };
}

// ───────── Lien avec la base de Pat ─────────
/** Producteur du tarif (nom écrit) relié à un producteur de la base : par son identifiant (proposition), ou son nom exact (liste). */
export async function associerProducteur(id: string, nomTarif: string, producteurId: string | null, f: FormData): Promise<Retour> {
  await exigerAdmin();
  let cible = producteurId;
  if (!cible) {
    const nom = txt(f, 'nom_base');
    if (!nom) return { erreur: 'Choisissez un producteur de la liste.' };
    const [p] = await requete<{ id: string }>(`select id from producteur where lower(nom) = lower($1) and statut <> 'retire' order by statut = 'valide' desc limit 1`, [nom]);
    if (!p) return { erreur: `« ${nom} » n’est pas dans la base : choisissez un nom de la liste, ou ajoutez le producteur.` };
    cible = p.id;
  }
  await relierProducteur(requete, id, nomTarif, cible);
  rafraichir(id);
  return { ok: 'Producteur relié : ses vins sont rattachés à la base.' };
}

export async function retirerLienProducteur(id: string, nomTarif: string): Promise<Retour> {
  await exigerAdmin();
  await relierProducteur(requete, id, nomTarif, null);
  rafraichir(id);
  return { ok: 'Lien retiré.' };
}

export async function ajouterProducteur(id: string, nomTarif: string): Promise<Retour> {
  await exigerAdmin();
  if (!nomTarif) return { erreur: 'Ce vin n’indique pas de producteur.' };
  await ajouterProducteurBase(requete, id, nomTarif);
  rafraichir(id);
  revalidatePath('/admin/super/producteurs');
  return { ok: `« ${nomTarif} » est ajouté à la base, à valider dans Producteurs.` };
}

/** Producteurs sans lien et sans proposition : tous ajoutés à la base, à valider. */
export async function ajouterProducteursSansProposition(id: string): Promise<Retour> {
  await exigerAdmin();
  const aAjouter = (await getProducteursDistributeur(id)).filter((p) => p.nom && !p.producteur_id && !p.suggestions.length);
  for (const p of aAjouter) await ajouterProducteurBase(requete, id, p.nom);
  rafraichir(id);
  revalidatePath('/admin/super/producteurs');
  return { ok: aAjouter.length ? `${aAjouter.length} producteur${aAjouter.length > 1 ? 's' : ''} ajouté${aAjouter.length > 1 ? 's' : ''} à la base, à valider dans Producteurs.` : 'Aucun producteur à ajouter.' };
}

/** Cépages et appellations des vins à valider de ce distributeur, cherchés sur son site public (en arrière-plan). */
export async function completerVins(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const aussiDejaCherches = f.get('aussi_deja') === 'on';
  await requete(`update distributeur set completion_statut = 'en_cours', completion_message = 'Recherche des cépages et appellations…', completion_le = now() where id = $1`, [id]);
  void completerVinsDistributeur(requete, id, { aussiDejaCherches });
  rafraichir(id);
  return { ok: 'Recherche lancée : la page se met à jour pendant la recherche.' };
}

/** Vins des producteurs reliés, absents de la base : ajoutés comme vins à valider (Vins de la base). */
export async function ajouterVinsBase(id: string): Promise<Retour> {
  await exigerAdmin();
  const n = await ajouterCuveesManquantes(requete, id);
  rafraichir(id);
  revalidatePath('/admin/super/vins');
  return { ok: n ? `${n} vin${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la base, à valider dans Vins de la base.` : 'Tous les vins des producteurs reliés sont déjà dans la base.' };
}

export async function ajouterVinDistributeur(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const libelle = txt(f, 'libelle')?.slice(0, 200);
  if (!libelle) return { erreur: 'Indiquez le nom du vin (appellation, cuvée).' };
  const prix = nombre(f, 'prix');
  if (prix === undefined) return { erreur: 'Prix illisible : écrivez par exemple 12,50.' };
  const millesime = txt(f, 'millesime');
  const v = { producteur: txt(f, 'producteur'), libelle, millesime: millesime && /^\d{4}$/.test(millesime) ? millesime : null, contenance: contenanceTarif(txt(f, 'contenance')) };
  const [{ ordre }] = await requete<{ ordre: number }>('select coalesce(max(ordre), 0) + 1 as ordre from distributeur_vin where distributeur_id = $1', [id]);
  const r = await requete(`insert into distributeur_vin (id, distributeur_id, cle, producteur_texte, libelle, millesime, contenance, couleur, prix_qv, ordre)
                           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) on conflict (distributeur_id, cle) do nothing returning id`,
    [randomUUID(), id, cleVin(v), v.producteur, v.libelle, v.millesime, v.contenance, txt(f, 'couleur'), prix, ordre]);
  if (!r.length) return { erreur: 'Ce vin est déjà dans la liste.' };
  rafraichir(id);
  return { ok: 'Vin ajouté.' };
}

/** Coordonnées de Quid Vinum : destinataire des commandes des restaurants (distributeurs de la base). */
export async function enregistrerQv(f: FormData): Promise<Retour> {
  await exigerAdmin();
  const email = txt(f, 'qv_email');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { erreur: 'L’adresse e-mail ne semble pas valide.' };
  await enregistrerCoordonneesQv({ qv_nom: txt(f, 'qv_nom'), qv_email: email, qv_adresse: txt(f, 'qv_adresse'), qv_tva: txt(f, 'qv_tva'), qv_telephone: txt(f, 'qv_telephone') });
  rafraichir();
  return { ok: 'Coordonnées de Quid Vinum enregistrées.' };
}
