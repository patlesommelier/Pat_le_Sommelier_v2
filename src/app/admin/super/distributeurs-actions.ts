'use server';
// Super-admin — distributeurs de Quid Vinum : coordonnées, marge, tarif (PDF lu par Claude), vins et prix.
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { enregistrerCoordonneesQv } from '@/lib/distributeurs/donnees';
import { lireTarif } from '@/lib/distributeurs/lecture';
import { cleVin, contenanceTarif } from '@/lib/distributeurs/tarif';
import { typeReel } from '@/lib/inscription/fichiers';

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

export async function enregistrerDistributeur(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const nom = txt(f, 'nom')?.slice(0, 120);
  if (!nom) return { erreur: 'Le nom ne peut pas être vide.' };
  const marge = nombre(f, 'marge'), remise = nombre(f, 'remise_qv');
  if (marge == null || marge > 500) return { erreur: 'La marge doit être un pourcentage, par exemple 15.' };
  if (remise === undefined || (remise != null && remise > 100)) return { erreur: 'La remise QV doit être un pourcentage, par exemple 20.' };
  const email = txt(f, 'email');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { erreur: 'L’adresse e-mail ne semble pas valide.' };
  try {
    await requete(`update distributeur set nom = $2, adresse = $3, tva = $4, contact = $5, telephone = $6, email = $7, site = $8, marge = $9, remise_qv = $10,
                   notes = $11, actif = $12 where id = $1`,
      [id, nom, txt(f, 'adresse'), txt(f, 'tva'), txt(f, 'contact'), txt(f, 'telephone'), email, txt(f, 'site'), marge, remise, txt(f, 'notes'), f.get('actif') === 'on']);
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

/** Lance la lecture du dernier tarif en arrière-plan (la page suit l'avancement). */
async function lancerLecture(id: string) {
  await requete(`update distributeur set lecture_statut = 'en_cours', lecture_message = 'Lecture du tarif par Claude…', lecture_le = now() where id = $1`, [id]);
  void lireTarif(requete, id);
}

/** Nouveau tarif (PDF) : gardé, puis lu par Claude. */
export async function deposerTarif(id: string, f: FormData) {
  await exigerAdmin();
  const fichier = f.get('tarif');
  const retour = (m: Record<string, string>) => redirect(`${page(id)}?${new URLSearchParams(m)}`);
  if (!(fichier instanceof File) || !fichier.size) retour({ erreur: 'Choisissez le fichier du tarif (PDF).' });
  const octets = new Uint8Array(await (fichier as File).arrayBuffer());
  if (octets.length > TARIF_MAX) retour({ erreur: 'Fichier trop lourd (20 Mo au maximum).' });
  if (typeReel(octets) !== 'application/pdf') retour({ erreur: 'Le tarif doit être un PDF.' });
  await requete('insert into distributeur_tarif (id, distributeur_id, nom, octets) values ($1, $2, $3, $4)',
    [randomUUID(), id, (fichier as File).name.slice(0, 160) || 'tarif.pdf', Buffer.from(octets)]);
  await lancerLecture(id);
  rafraichir(id);
  retour({ ok: 'Tarif enregistré : Claude le lit (quelques minutes).' });
}

export async function relireTarif(id: string): Promise<Retour> {
  await exigerAdmin();
  await lancerLecture(id);
  rafraichir(id);
  return { ok: 'Lecture relancée.' };
}

/**
 * Tableau des vins : prix QV (prix_<id>), prix imposé aux restaurants (impose_<id>, vide : prix QV + marge),
 * producteur de la base (prod_<id> : nom exact d'un producteur, vide : aucun), proposé ou non (actif_<id>).
 */
export async function enregistrerVins(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const ids = [...f.keys()].filter((k) => k.startsWith('prix_')).map((k) => k.slice(5));
  if (!ids.length) return { ok: 'Rien à enregistrer.' };
  const prix = ids.map((v) => nombre(f, `prix_${v}`)), imposes = ids.map((v) => nombre(f, `impose_${v}`));
  const illisibles = ids.filter((_, i) => prix[i] === undefined || imposes[i] === undefined).length;
  // Producteurs : seulement ceux qui ont changé, retrouvés par leur nom exact dans la base de Pat.
  const actuels = new Map((await requete<{ id: string; nom: string | null }>(
    `select v.id, p.nom from distributeur_vin v left join producteur p on p.id = v.producteur_id where v.distributeur_id = $1`, [id])).map((r) => [r.id, r.nom ?? '']));
  const noms = [...new Set(ids.map((v) => txt(f, `prod_${v}`)).filter((n): n is string => Boolean(n)))];
  const parNom = new Map((noms.length ? await requete<{ id: string; nom: string }>(
    `select distinct on (lower(nom)) id, nom from producteur where lower(nom) = any($1) and statut <> 'retire' order by lower(nom), statut = 'valide' desc`,
    [noms.map((n) => n.toLowerCase())]) : []).map((p) => [p.nom.toLowerCase(), p.id]));
  const changes = ids.filter((v) => f.has(`prod_${v}`) && (txt(f, `prod_${v}`) ?? '') !== actuels.get(v));
  const inconnus = changes.filter((v) => txt(f, `prod_${v}`) && !parNom.has(txt(f, `prod_${v}`)!.toLowerCase())).length;
  const lisibles = (i: number) => prix[i] !== undefined && imposes[i] !== undefined;
  await requete(
    `update distributeur_vin v set prix_qv = x.prix, prix_restaurant = x.impose, actif = x.actif, maj_le = now()
       from unnest($2::text[], $3::numeric[], $4::numeric[], $5::bool[]) as x(id, prix, impose, actif)
      where v.distributeur_id = $1 and v.id = x.id`,
    [id, ids.filter((_, i) => lisibles(i)), prix.filter((_, i) => lisibles(i)), imposes.filter((_, i) => lisibles(i)),
      ids.filter((_, i) => lisibles(i)).map((v) => f.get(`actif_${v}`) === 'on')]);
  for (const v of changes) {
    const nom = txt(f, `prod_${v}`);
    const producteur = nom ? parNom.get(nom.toLowerCase()) : null;
    if (producteur === undefined) continue;
    await requete('update distributeur_vin set producteur_id = $3, producteur_manuel = true where distributeur_id = $1 and id = $2', [id, v, producteur]);
  }
  rafraichir(id);
  const avertissements = [illisibles ? `${illisibles} prix illisible${illisibles > 1 ? 's' : ''} (écrivez par exemple 12,50)` : '',
    inconnus ? `${inconnus} producteur${inconnus > 1 ? 's' : ''} introuvable${inconnus > 1 ? 's' : ''} dans la base (choisissez un nom de la liste)` : ''].filter(Boolean);
  return avertissements.length ? { erreur: `Enregistré, sauf : ${avertissements.join(' ; ')}.` } : { ok: 'Vins enregistrés.' };
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
