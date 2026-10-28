'use server';
// Gestion des stocks : stocks des vins, fournisseurs, paramètres, commandes de vin (bon de commande PDF, envoi, réception).
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requete } from '@/lib/db';
import { exigerAcces } from '@/lib/admin/auth';
import { choisirFournisseur, donneesBon } from '@/lib/admin/stocks';
import { genererBonCommande, referenceCommande } from '@/lib/bon-commande';
import { envoyerEmail } from '@/lib/email';
import { contenanceDuFormat, grouperMemeVin } from '@/lib/contenances';

type Retour = { ok?: string; erreur?: string };

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const entier = (f: FormData, k: string) => {
  const v = txt(f, k);
  if (v === null) return null;
  const n = Math.round(Number(v.replace(',', '.')));
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
};

const rafraichir = (resto: string) => {
  for (const p of ['stocks', 'commandes', 'fournisseurs', 'parametres', 'carte']) revalidatePath(`/admin/${resto}/${p}`);
};

/** Toutes les lignes (contenances) des vins dont on donne la ligne principale. */
async function lignesDesVins(resto: string, principaux: string[]) {
  const lignes = await requete<{ id: string; couleur: string; libelle: string; millesime: string | null; format: string }>(
    'select id, couleur::text, libelle, millesime, format from vin_carte where restaurant_id = $1 order by ordre, id', [resto]);
  const groupes = grouperMemeVin(lignes, (l) => l.format);
  return new Map(principaux.map((id) => [id, (groupes.find((g) => g.some((l) => l.id === id)) ?? []).map((l) => l.id)]));
}

// ───────── Stocks ─────────
/** Page Stocks : stock, bouteilles en commande et fournisseur de chaque vin (champs stock_<id>, en_commande_<id>, fournisseur_<id>). */
export async function enregistrerStocks(resto: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  const ids = [...f.keys()].filter((k) => k.startsWith('stock_')).map((k) => k.slice(6));
  const groupes = await lignesDesVins(resto, ids);
  let n = 0;
  for (const id of ids) {
    const stock = entier(f, `stock_${id}`), commande = entier(f, `en_commande_${id}`);
    const r = await requete('update vin_carte set stock = coalesce($3, stock), en_commande = coalesce($4, en_commande) where restaurant_id = $1 and id = $2 returning id',
      [resto, id, stock, commande]);
    if (!r.length) continue;
    n++;
    if (f.has(`fournisseur_${id}`)) await choisirFournisseur(resto, groupes.get(id) ?? [id], txt(f, `fournisseur_${id}`), txt(f, `fournisseur_nouveau_${id}`));
  }
  rafraichir(resto);
  return { ok: `Stocks enregistrés (${n} vin${n > 1 ? 's' : ''}).` };
}

// ───────── Fournisseurs ─────────
const champsFournisseur = (f: FormData) => [txt(f, 'nom')?.slice(0, 120) ?? null, txt(f, 'adresse'), txt(f, 'tva'), txt(f, 'contact'), txt(f, 'telephone'), txt(f, 'email')];

export async function ajouterFournisseur(resto: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  const champs = champsFournisseur(f);
  if (!champs[0]) return { erreur: 'Indiquez le nom du fournisseur.' };
  if (champs[5] && !/^\S+@\S+\.\S+$/.test(champs[5])) return { erreur: 'L’adresse e-mail du fournisseur ne semble pas valide.' };
  await requete('insert into fournisseur (id, restaurant_id, nom, adresse, tva, contact, telephone, email) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [randomUUID(), resto, ...champs]);
  rafraichir(resto);
  const retour = txt(f, 'retour');
  if (retour?.startsWith(`/admin/${resto}/`)) redirect(retour);
  return { ok: `Fournisseur « ${champs[0]} » ajouté.` };
}

export async function modifierFournisseur(resto: string, id: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  const champs = champsFournisseur(f);
  if (!champs[0]) return { erreur: 'Le nom du fournisseur ne peut pas être vide.' };
  if (champs[5] && !/^\S+@\S+\.\S+$/.test(champs[5])) return { erreur: 'L’adresse e-mail du fournisseur ne semble pas valide.' };
  await requete('update fournisseur set nom = $3, adresse = $4, tva = $5, contact = $6, telephone = $7, email = $8 where id = $1 and restaurant_id = $2', [id, resto, ...champs]);
  rafraichir(resto);
  return { ok: 'Fournisseur enregistré.' };
}

export async function supprimerFournisseur(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  await requete('delete from fournisseur where id = $1 and restaurant_id = $2', [id, resto]); // ses vins restent, sans fournisseur
  rafraichir(resto);
  return { ok: 'Fournisseur supprimé : ses vins n’ont plus de fournisseur.' };
}

// ───────── Paramètres ─────────
export async function enregistrerParametresStock(resto: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  const limite = entier(f, 'stock_limite_basse');
  if (limite === null || limite > 1000) return { erreur: 'La limite de stock bas doit être un nombre de bouteilles (0 ou plus).' };
  const email = txt(f, 'commande_email');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { erreur: 'Votre adresse e-mail ne semble pas valide.' };
  await requete(
    `update restaurant set stock_limite_basse = $2, commande_societe = $3, commande_adresse = $4, commande_tva = $5, commande_contact = $6,
            commande_telephone = $7, commande_email = $8 where id = $1`,
    [resto, limite, txt(f, 'commande_societe'), txt(f, 'commande_adresse'), txt(f, 'commande_tva'), txt(f, 'commande_contact'), txt(f, 'commande_telephone'), email]);
  rafraichir(resto);
  return { ok: 'Paramètres enregistrés.' };
}

// ───────── Commandes ─────────
/**
 * Nouvelle commande à un fournisseur (ou sans fournisseur : '') : champs qte_<id du vin> en bouteilles.
 * Les bouteilles passent « en commande » sur chaque vin ; on revient sur la commande créée (PDF, envoi par e-mail).
 */
export async function creerCommande(resto: string, fournisseurId: string, f: FormData): Promise<Retour> {
  const u = await exigerAcces(resto);
  const quantites = [...f.keys()].filter((k) => k.startsWith('qte_')).map((k) => [k.slice(4), entier(f, k) ?? 0] as const).filter(([, q]) => q > 0);
  if (!quantites.length) return { erreur: 'Indiquez au moins un nombre de bouteilles à commander.' };
  // Vins sans fournisseur : le fournisseur peut être choisi au moment de commander (il leur est alors attribué).
  const choisi = fournisseurId || txt(f, 'fournisseur') || '';
  if (!fournisseurId && choisi) await choisirFournisseur(resto, quantites.map(([id]) => id), choisi, null);
  fournisseurId = choisi;
  const [fournisseur] = fournisseurId
    ? await requete<{ nom: string }>('select nom from fournisseur where id = $1 and restaurant_id = $2', [fournisseurId, resto]) : [{ nom: 'Fournisseur à préciser' }];
  if (!fournisseur) return { erreur: 'Fournisseur introuvable.' };
  const vins = await requete<{ id: string; libelle: string; millesime: string | null; format: string; producteur: string | null }>(
    `select v.id, v.libelle, v.millesime, v.format, coalesce(nullif(v.producteur_texte, ''), p.nom) as producteur
       from vin_carte v left join producteur p on p.id = v.producteur_id where v.restaurant_id = $1 and v.id = any($2)`, [resto, quantites.map(([id]) => id)]);
  const id = randomUUID();
  const [{ numero }] = await requete<{ numero: number }>('select coalesce(max(numero), 0) + 1 as numero from commande where restaurant_id = $1', [resto]);
  await requete('insert into commande (id, restaurant_id, fournisseur_id, fournisseur_nom, numero, cree_par) values ($1, $2, $3, $4, $5, $6)',
    [id, resto, fournisseurId || null, fournisseur.nom, numero, u.email]);
  let ordre = 0;
  for (const [vinId, q] of quantites) {
    const v = vins.find((x) => x.id === vinId);
    if (!v) continue;
    const millesime = v.millesime && !v.libelle.includes(v.millesime) ? ` ${v.millesime}` : '';
    const detail = [v.producteur && !/^non /i.test(v.producteur) ? v.producteur : null, contenanceDuFormat(v.format) === 'verre' ? null : v.format].filter(Boolean).join(' · ');
    await requete('insert into commande_ligne (commande_id, vin_id, libelle, detail, quantite, ordre) values ($1, $2, $3, $4, $5, $6)',
      [id, vinId, `${v.libelle}${millesime}`, detail || null, q, ordre++]);
    await requete('update vin_carte set en_commande = en_commande + $3 where restaurant_id = $1 and id = $2', [resto, vinId, q]);
  }
  rafraichir(resto);
  redirect(`/admin/${resto}/commandes?commande=${id}#commande-${id}`);
}

/** Envoie le bon de commande (PDF en pièce jointe) au fournisseur, avec le restaurant en copie. */
export async function envoyerCommande(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  const bon = await donneesBon(resto, id);
  if (!bon) return { erreur: 'Commande introuvable.' };
  if (!bon.fournisseur.email) return { erreur: `Ajoutez l’adresse e-mail de « ${bon.fournisseur.nom} » dans Fournisseurs.` };
  const ref = referenceCommande(bon);
  const total = bon.lignes.reduce((n, l) => n + l.quantite, 0);
  const erreur = await envoyerEmail({
    a: bon.fournisseur.email, copie: bon.restaurant.email, repondreA: bon.restaurant.email,
    sujet: `Bon de commande ${ref} — ${bon.restaurant.nom}`,
    texte: `Bonjour${bon.fournisseur.contact ? ` ${bon.fournisseur.contact}` : ''},\n\nVeuillez trouver ci-joint notre bon de commande n° ${ref} (${total} bouteille${total > 1 ? 's' : ''}) :\n\n`
      + bon.lignes.map((l) => `- ${l.quantite} × ${l.libelle}${l.detail ? ` (${l.detail})` : ''}`).join('\n')
      + `\n\nMerci de nous confirmer la commande et la date de livraison${bon.restaurant.email ? ` en répondant à cet e-mail` : ''}.\n\n${bon.restaurant.nom}${bon.restaurant.telephone ? `\n${bon.restaurant.telephone}` : ''}`,
    pieceJointe: { nom: `bon-de-commande-${ref}.pdf`, octets: genererBonCommande(bon) },
  });
  if (erreur) return { erreur };
  await requete('update commande set envoyee_le = now(), envoyee_a = $3 where id = $1 and restaurant_id = $2', [id, resto, bon.fournisseur.email]);
  rafraichir(resto);
  return { ok: `Bon de commande envoyé à ${bon.fournisseur.email}.` };
}

/** Commande envoyée par le restaurant lui-même (partage du PDF ou messagerie) : statut « Commande envoyée ». */
export async function marquerEnvoyee(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  await requete(`update commande c set envoyee_le = now(), envoyee_a = (select email from fournisseur f where f.id = c.fournisseur_id)
                  where c.id = $1 and c.restaurant_id = $2 and c.statut = 'ouverte'`, [id, resto]);
  rafraichir(resto);
  return { ok: 'Commande envoyée.' };
}

/** Bouteilles réceptionnées : celles de la commande passent du « en commande » au stock. */
export async function receptionnerCommande(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  const r = await requete(`update commande set statut = 'recue', recue_le = now() where id = $1 and restaurant_id = $2 and statut = 'ouverte' returning id`, [id, resto]);
  if (!r.length) return { erreur: 'Cette commande n’est plus ouverte.' };
  await requete(
    `update vin_carte v set stock = v.stock + l.q, en_commande = greatest(v.en_commande - l.q, 0)
       from (select vin_id, sum(quantite)::int as q from commande_ligne where commande_id = $1 and vin_id is not null group by vin_id) l
      where v.id = l.vin_id and v.restaurant_id = $2`, [id, resto]);
  rafraichir(resto);
  return { ok: 'Bouteilles réceptionnées : elles sont ajoutées au stock.' };
}

/** Commande annulée : ses bouteilles ne sont plus « en commande ». */
export async function annulerCommande(resto: string, id: string): Promise<Retour> {
  await exigerAcces(resto);
  const r = await requete(`update commande set statut = 'annulee' where id = $1 and restaurant_id = $2 and statut = 'ouverte' returning id`, [id, resto]);
  if (!r.length) return { erreur: 'Cette commande n’est plus ouverte.' };
  await requete(
    `update vin_carte v set en_commande = greatest(v.en_commande - l.q, 0)
       from (select vin_id, sum(quantite)::int as q from commande_ligne where commande_id = $1 and vin_id is not null group by vin_id) l
      where v.id = l.vin_id and v.restaurant_id = $2`, [id, resto]);
  rafraichir(resto);
  return { ok: 'Commande annulée.' };
}
