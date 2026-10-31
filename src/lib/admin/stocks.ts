import 'server-only';
// Gestion des stocks : fournisseurs et commandes de vin d'un restaurant.
import { requete } from '../db';
import { getCoordonneesQv } from '../distributeurs/donnees';

/** distributeur_id : fournisseur choisi dans la base de Quid Vinum (ses commandes partent chez Quid Vinum). */
export interface Fournisseur { id: string; nom: string; adresse: string | null; tva: string | null; contact: string | null; telephone: string | null; email: string | null; vins: number; distributeur_id: string | null; logo_url: string | null }
export interface LigneCommande { vin_id: string | null; distributeur_vin_id: string | null; libelle: string; detail: string | null; quantite: number; prix_achat: number | null }
export interface Commande {
  id: string; numero: number; fournisseur_id: string | null; fournisseur_nom: string; fournisseur_email: string | null; via_qv: boolean; statut: 'ouverte' | 'recue' | 'annulee';
  cree_le: string; envoyee_le: string | null; envoyee_a: string | null; recue_le: string | null; lignes: LigneCommande[];
}
export interface CoordonneesRestaurant { nom: string; stock_limite_basse: number; commande_societe: string | null; commande_adresse: string | null;
  commande_tva: string | null; commande_contact: string | null; commande_telephone: string | null; commande_email: string | null }

/**
 * Prix d'achat HTVA de chaque vin (id de la ligne → prix) : lu seulement par les pages Stocks et Commandes de vin,
 * jamais avec la carte des vins (ni l'app des clients, ni la carte imprimée).
 */
export async function getPrixAchat(resto: string) {
  const lignes = await requete<{ id: string; prix_achat: number }>('select id, prix_achat from vin_carte where restaurant_id = $1 and prix_achat is not null', [resto]);
  return new Map(lignes.map((l) => [l.id, Number(l.prix_achat)]));
}

/** Adresse où part un bon de commande (f : fournisseur) : Quid Vinum pour un distributeur de sa base, sinon le fournisseur. */
export const SQL_EMAIL_COMMANDE = `case when f.distributeur_id is not null then (select valeur from reglage_serveur where cle = 'qv_email') else f.email end`;

/** Stock bas : à la limite d'alerte ou en dessous. */
export const stockBas = (stock: number, limite: number) => stock <= limite;

export async function getFournisseurs(resto: string) {
  return requete<Fournisseur>(
    `select f.id, f.nom, f.adresse, f.tva, f.contact, f.telephone, f.email, f.distributeur_id,
            (select d.logo_url from distributeur d where d.id = f.distributeur_id) as logo_url,
            (select count(distinct lower(v.libelle) || coalesce(v.millesime, ''))::int from vin_carte v where v.fournisseur_id = f.id) as vins -- un vin, toutes contenances
       from fournisseur f where f.restaurant_id = $1 order by lower(f.nom)`, [resto]);
}

export async function getCoordonnees(resto: string) {
  const [r] = await requete<CoordonneesRestaurant>(
    `select nom, stock_limite_basse, commande_societe, commande_adresse, commande_tva, commande_contact, commande_telephone, commande_email
       from restaurant where id = $1`, [resto]);
  return r ?? null;
}

/** Commandes du restaurant (les plus récentes d'abord), avec leurs lignes. */
export async function getCommandes(resto: string, statuts: Commande['statut'][], limite = 50) {
  const commandes = await requete<Omit<Commande, 'lignes'>>(
    `select c.id, c.numero, c.fournisseur_id, c.fournisseur_nom, c.statut, c.cree_le::text, c.envoyee_le::text, c.envoyee_a, c.recue_le::text,
            ${SQL_EMAIL_COMMANDE} as fournisseur_email, f.distributeur_id is not null as via_qv
       from commande c left join fournisseur f on f.id = c.fournisseur_id
      where c.restaurant_id = $1 and c.statut = any($2) order by c.cree_le desc limit $3`, [resto, statuts, limite]);
  const lignes = commandes.length ? await requete<LigneCommande & { commande_id: string }>(
    'select commande_id, vin_id, distributeur_vin_id, libelle, detail, quantite, prix_achat from commande_ligne where commande_id = any($1) order by ordre', [commandes.map((c) => c.id)]) : [];
  return commandes.map((c) => ({ ...c, lignes: lignes.filter((l) => l.commande_id === c.id) })) as Commande[];
}

/**
 * Fournisseur choisi dans une liste déroulante (fiche du vin, page Stocks) : un fournisseur existant, aucun (''),
 * ou « nouveau » avec son nom (créé ici). Appliqué à toutes les lignes du vin. Renvoie l'id retenu.
 */
export async function choisirFournisseur(resto: string, vinIds: string[], valeur: string | null, nouveauNom: string | null) {
  let id: string | null = valeur || null;
  if (valeur === 'nouveau') {
    const nom = nouveauNom?.trim();
    if (!nom) return undefined; // pas de nom : rien ne change
    const [existant] = await requete<{ id: string }>('select id from fournisseur where restaurant_id = $1 and lower(nom) = lower($2)', [resto, nom]);
    id = existant?.id ?? crypto.randomUUID();
    if (!existant) await requete('insert into fournisseur (id, restaurant_id, nom) values ($1, $2, $3)', [id, resto, nom.slice(0, 120)]);
  } else if (id && !(await requete('select 1 from fournisseur where id = $1 and restaurant_id = $2', [id, resto])).length) {
    return undefined; // fournisseur d'un autre restaurant : refusé
  }
  await requete('update vin_carte set fournisseur_id = $3 where restaurant_id = $1 and id = any($2)', [resto, vinIds, id]);
  return id;
}

/** Données du bon de commande (PDF) d'une commande du restaurant. */
export async function donneesBon(resto: string, commandeId: string) {
  const [[c], r] = await Promise.all([
    requete<{ numero: number; cree_le: Date; fournisseur_nom: string; nom: string | null; adresse: string | null; tva: string | null; contact: string | null; telephone: string | null; email: string | null; distributeur_id: string | null }>(
      `select c.numero, c.cree_le, c.fournisseur_nom, f.nom, f.adresse, f.tva, f.contact, f.telephone, f.email, f.distributeur_id
         from commande c left join fournisseur f on f.id = c.fournisseur_id where c.id = $1 and c.restaurant_id = $2`, [commandeId, resto]),
    getCoordonnees(resto),
  ]);
  if (!c || !r) return null;
  const lignes = await requete<{ libelle: string; detail: string | null; quantite: number; prix_achat: number | null }>(
    'select libelle, detail, quantite, prix_achat from commande_ligne where commande_id = $1 order by ordre', [commandeId]);
  return {
    numero: c.numero, date: new Date(c.cree_le),
    restaurant: { nom: r.commande_societe || r.nom, adresse: r.commande_adresse, tva: r.commande_tva, contact: r.commande_contact, telephone: r.commande_telephone, email: r.commande_email },
    // Distributeur de la base de Quid Vinum : le bon est adressé à Quid Vinum, pour ce distributeur.
    fournisseur: c.distributeur_id
      ? await (async () => { const qv = await getCoordonneesQv(); return { nom: qv.nom, adresse: qv.adresse, tva: qv.tva, contact: `Pour ${c.nom ?? c.fournisseur_nom}`, telephone: qv.telephone, email: qv.email }; })()
      : { nom: c.nom ?? c.fournisseur_nom, adresse: c.adresse, tva: c.tva, contact: c.contact, telephone: c.telephone, email: c.email },
    distributeur: c.distributeur_id ? (c.nom ?? c.fournisseur_nom) : null,
    lignes,
  };
}
