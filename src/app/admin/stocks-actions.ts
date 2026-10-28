'use server';
// Gestion des stocks : stocks des vins, fournisseurs, paramètres, commandes de vin (bon de commande PDF, envoi, réception).
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requete } from '@/lib/db';
import { exigerAcces } from '@/lib/admin/auth';
import { choisirFournisseur, donneesBon } from '@/lib/admin/stocks';
import { euros, genererBonCommande, referenceCommande } from '@/lib/bon-commande';
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

/** Prix en euros (virgule ou point) ; vide : null ; illisible : undefined (on ne change rien). */
const prix = (f: FormData, k: string): number | null | undefined => {
  if (!f.has(k)) return undefined;
  const v = txt(f, k);
  if (v === null) return null;
  const n = Number(v.replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : undefined;
};

const rafraichir = (resto: string) => {
  for (const p of ['stocks', 'commandes', 'fournisseurs', 'parametres', 'carte']) revalidatePath(`/admin/${resto}/${p}`);
  revalidatePath(`/${resto}`, 'layout'); // l'app des clients (prix de vente)
};

/** Toutes les lignes (contenances) des vins dont on donne la ligne principale. */
async function lignesDesVins(resto: string, principaux: string[]) {
  const lignes = await requete<{ id: string; couleur: string; libelle: string; millesime: string | null; format: string }>(
    'select id, couleur::text, libelle, millesime, format from vin_carte where restaurant_id = $1 order by ordre, id', [resto]);
  const groupes = grouperMemeVin(lignes, (l) => l.format);
  return new Map(principaux.map((id) => [id, (groupes.find((g) => g.some((l) => l.id === id)) ?? []).map((l) => l.id)]));
}

// ───────── Stocks ─────────
/** Page Stocks : stock, bouteilles en commande, prix d'achat HTVA et fournisseur de chaque vin (champs stock_<id>, en_commande_<id>, achat_<id>, fournisseur_<id>). */
export async function enregistrerStocks(resto: string, f: FormData): Promise<Retour> {
  await exigerAcces(resto);
  const ids = [...f.keys()].filter((k) => k.startsWith('stock_')).map((k) => k.slice(6));
  if (!ids.length) return { ok: 'Rien à enregistrer.' };
  // Une seule requête pour tous les vins (une par vin dépassait le temps d'une action sur le serveur en ligne).
  const achats = ids.map((id) => prix(f, `achat_${id}`));
  // Prix de vente (bouteille, sur la carte) : un champ vidé ne retire pas le prix de la carte.
  const ventes = ids.map((id) => prix(f, `vente_${id}`) ?? undefined);
  const illisibles = ids.filter((id, i) => (achats[i] === undefined && txt(f, `achat_${id}`) !== null) || (ventes[i] === undefined && txt(f, `vente_${id}`) !== null));
  const r = await requete<{ id: string }>(
    `update vin_carte v set stock = coalesce(x.stock, v.stock), en_commande = coalesce(x.commande, v.en_commande),
            prix_achat = case when x.achat_envoye then x.achat else v.prix_achat end, prix = coalesce(x.vente, v.prix)
       from unnest($2::text[], $3::int[], $4::int[], $5::numeric[], $6::bool[], $7::numeric[]) as x(id, stock, commande, achat, achat_envoye, vente)
      where v.restaurant_id = $1 and v.id = x.id returning v.id`,
    [resto, ids, ids.map((id) => entier(f, `stock_${id}`)), ids.map((id) => entier(f, `en_commande_${id}`)),
      achats.map((a) => a ?? null), achats.map((a) => a !== undefined), ventes.map((v) => v ?? null)]);
  // Fournisseurs : seulement ceux qui ont changé (ou un nouveau fournisseur à créer).
  const actuels = new Map((await requete<{ id: string; fournisseur_id: string | null }>(
    'select id, fournisseur_id from vin_carte where restaurant_id = $1 and id = any($2)', [resto, ids])).map((v) => [v.id, v.fournisseur_id ?? '']));
  const changes = ids.filter((id) => f.has(`fournisseur_${id}`) && (txt(f, `fournisseur_${id}`) ?? '') !== actuels.get(id));
  if (changes.length) {
    const groupes = await lignesDesVins(resto, changes);
    for (const id of changes) await choisirFournisseur(resto, groupes.get(id) ?? [id], txt(f, `fournisseur_${id}`), txt(f, `fournisseur_nouveau_${id}`));
  }
  rafraichir(resto);
  const n = r.length;
  if (illisibles.length) return { erreur: `Stocks enregistrés, sauf ${illisibles.length} prix illisible${illisibles.length > 1 ? 's' : ''} : écrivez par exemple 12,50.` };
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
    // Prix d'achat HTVA : celui indiqué au moment de commander (il devient le prix d'achat du vin), sinon celui du vin.
    const achat = prix(f, `achat_${vinId}`);
    if (achat !== undefined) await requete('update vin_carte set prix_achat = $3 where restaurant_id = $1 and id = $2', [resto, vinId, achat]);
    await requete(`insert into commande_ligne (commande_id, vin_id, libelle, detail, quantite, ordre, prix_achat)
                   values ($1, $2, $3, $4, $5, $6, (select prix_achat from vin_carte where id = $2))`,
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
      + bon.lignes.map((l) => `- ${l.quantite} × ${l.libelle}${l.detail ? ` (${l.detail})` : ''}${l.prix_achat != null ? ` à ${euros(l.prix_achat)} HTVA` : ''}`).join('\n')
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
