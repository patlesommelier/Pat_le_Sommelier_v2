import 'server-only';
// Gestion des stocks : fournisseurs et commandes de vin d'un restaurant.
import { requete } from '../db';
import { getCoordonneesQv } from '../distributeurs/donnees';
import { associerAuCatalogue } from './distributeur-vin';

/** distributeur_id : fournisseur choisi dans la base de Quid Vinum (ses commandes partent chez Quid Vinum). */
export interface Fournisseur { id: string; nom: string; adresse: string | null; tva: string | null; contact: string | null; telephone: string | null; email: string | null; vins: number; distributeur_id: string | null; logo_url: string | null }
export interface LigneCommande { vin_id: string | null; distributeur_vin_id: string | null; libelle: string; detail: string | null; quantite: number; prix_achat: number | null; recue: number; ordre: number;
  /** Photo du vin (sa ligne de carte, son vin de catalogue ou le vin de la base) et logo de son distributeur, pour l'affichage. */
  etiquette?: string | null; logo?: string | null }
export interface Reception { id: string; numero: number; complete: boolean; cree_le: string }
export interface Commande {
  id: string; numero: number; fournisseur_id: string | null; fournisseur_nom: string; fournisseur_email: string | null; via_qv: boolean; statut: 'ouverte' | 'recue' | 'annulee';
  cree_le: string; envoyee_le: string | null; envoyee_a: string | null; recue_le: string | null; lignes: LigneCommande[]; receptions: Reception[];
  /** Suivi par Quid Vinum (super-admin) : reçue, acceptée, envoyée au distributeur, livrée, facturée. */
  statut_qv: string | null; statut_qv_le: string | null; motif_refus: string | null;
  /** Numéro de commande interne du restaurant (facultatif). */
  reference_interne: string | null;
  /** Facture jointe par Quid Vinum (date), servie par /commandes/<id>/facture. */
  facture_le: string | null;
}
export interface CoordonneesRestaurant { nom: string; stock_limite_basse: number; commande_societe: string | null; commande_adresse: string | null;
  commande_tva: string | null; commande_contact: string | null; commande_telephone: string | null; commande_email: string | null;
  /** Adresse de facturation, quand elle diffère de l'adresse de livraison (commande_adresse). */
  commande_adresse_facturation: string | null }

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
    `select nom, stock_limite_basse, commande_societe, commande_adresse, commande_tva, commande_contact, commande_telephone, commande_email,
            commande_adresse_facturation from restaurant where id = $1`, [resto]);
  return r ?? null;
}

/** Commandes du restaurant (les plus récentes d'abord), avec leurs lignes. */
export async function getCommandes(resto: string, statuts: Commande['statut'][], limite = 50) {
  const commandes = await requete<Omit<Commande, 'lignes'>>(
    `select c.id, c.numero, c.fournisseur_id, c.fournisseur_nom, c.statut, c.cree_le::text, c.envoyee_le::text, c.envoyee_a, c.recue_le::text, c.statut_qv, c.statut_qv_le::text, c.motif_refus, c.reference_interne,
            (select fc.depose_le::text from facture_commande fc where fc.commande_id = c.id) as facture_le,
            case when c.quid_vinum then (select valeur from reglage_serveur where cle = 'qv_email') else ${SQL_EMAIL_COMMANDE} end as fournisseur_email,
            (c.quid_vinum or f.distributeur_id is not null) as via_qv
       from commande c left join fournisseur f on f.id = c.fournisseur_id
      where c.restaurant_id = $1 and c.statut = any($2) order by c.cree_le desc limit $3`, [resto, statuts, limite]);
  const lignes = commandes.length ? await requete<LigneCommande & { commande_id: string }>(
    `select l.commande_id, l.vin_id, l.distributeur_vin_id, l.libelle, l.detail, l.quantite, l.prix_achat, l.recue, l.ordre,
            coalesce(v.etiquette_url, dv.etiquette_url, c.etiquette_url) as etiquette,
            (select d.logo_url from distributeur d where d.id = coalesce(dv.distributeur_id,
               (select f.distributeur_id from fournisseur f where f.id = v.fournisseur_id))) as logo
       from commande_ligne l left join vin_carte v on v.id = l.vin_id left join distributeur_vin dv on dv.id = l.distributeur_vin_id
       left join cuvee c on c.id = coalesce(v.cuvee_id, dv.cuvee_id)
      where l.commande_id = any($1) order by l.ordre`, [commandes.map((c) => c.id)]) : [];
  const receptions = commandes.length ? await requete<Reception & { commande_id: string }>(
    'select id, commande_id, numero, complete, cree_le::text from reception where commande_id = any($1) order by numero', [commandes.map((c) => c.id)]) : [];
  return commandes.map((c) => ({ ...c, lignes: lignes.filter((l) => l.commande_id === c.id), receptions: receptions.filter((r) => r.commande_id === c.id) })) as Commande[];
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
  // Distributeur de Quid Vinum : le vin est cherché dans son catalogue (prix d'achat, commande).
  await associerAuCatalogue(resto, vinIds, id).catch((e) => console.error('[fournisseur] catalogue', e));
  return id;
}

/** Données du bon de commande (PDF) d'une commande du restaurant. */
export async function donneesBon(resto: string, commandeId: string) {
  const [[c], r] = await Promise.all([
    requete<{ numero: number; cree_le: Date; fournisseur_nom: string; nom: string | null; adresse: string | null; tva: string | null; contact: string | null; telephone: string | null; email: string | null; distributeur_id: string | null; quid_vinum: boolean; reference_interne: string | null }>(
      `select c.numero, c.cree_le, c.fournisseur_nom, f.nom, f.adresse, f.tva, f.contact, f.telephone, f.email, f.distributeur_id, c.quid_vinum, c.reference_interne
         from commande c left join fournisseur f on f.id = c.fournisseur_id where c.id = $1 and c.restaurant_id = $2`, [commandeId, resto]),
    getCoordonnees(resto),
  ]);
  if (!c || !r) return null;
  const lignes = await requete<{ libelle: string; detail: string | null; quantite: number; prix_achat: number | null }>(
    'select libelle, detail, quantite, prix_achat from commande_ligne where commande_id = $1 order by ordre', [commandeId]);
  return {
    numero: c.numero, date: new Date(c.cree_le), referenceInterne: c.reference_interne,
    restaurant: { nom: r.commande_societe || r.nom, adresse: r.commande_adresse, facturation: r.commande_adresse_facturation, tva: r.commande_tva, contact: r.commande_contact, telephone: r.commande_telephone, email: r.commande_email },
    // Distributeur de la base de Quid Vinum : le bon est adressé à Quid Vinum, pour ce distributeur.
    // Commande Quid Vinum (plusieurs distributeurs) : adressée à Quid Vinum ; chaque ligne nomme son distributeur.
    fournisseur: c.quid_vinum
      ? await (async () => { const qv = await getCoordonneesQv(); return { nom: qv.nom, adresse: qv.adresse, tva: qv.tva, contact: 'Commande pour les distributeurs Quid Vinum', telephone: qv.telephone, email: qv.email }; })()
      : c.distributeur_id
      ? await (async () => { const qv = await getCoordonneesQv(); return { nom: qv.nom, adresse: qv.adresse, tva: qv.tva, contact: `Pour ${c.nom ?? c.fournisseur_nom}`, telephone: qv.telephone, email: qv.email }; })()
      : { nom: c.nom ?? c.fournisseur_nom, adresse: c.adresse, tva: c.tva, contact: c.contact, telephone: c.telephone, email: c.email },
    distributeur: c.distributeur_id ? (c.nom ?? c.fournisseur_nom) : null,
    quidVinum: c.quid_vinum,
    lignes,
  };
}

/** Données du bon de réception (PDF) : la commande, et les bouteilles reçues lors de cette réception. */
export async function donneesReception(resto: string, commandeId: string, receptionId: string) {
  const bon = await donneesBon(resto, commandeId);
  const [r] = await requete<{ numero: number; complete: boolean; cree_le: Date }>(
    'select r.numero, r.complete, r.cree_le from reception r join commande c on c.id = r.commande_id where r.id = $1 and c.id = $2 and c.restaurant_id = $3', [receptionId, commandeId, resto]);
  if (!bon || !r) return null;
  const lignes = await requete<{ libelle: string; detail: string | null; quantite: number; commandee: number; prix_achat: number | null }>(
    'select libelle, detail, quantite, commandee, prix_achat::float8 as prix_achat from reception_ligne where reception_id = $1 order by ordre', [receptionId]);
  const [{ reste }] = await requete<{ reste: number }>('select coalesce(sum(quantite - recue), 0)::int as reste from commande_ligne where commande_id = $1', [commandeId]);
  return { bon, reception: { numero: r.numero, complete: r.complete, date: new Date(r.cree_le), lignes, reste } };
}

/**
 * Mode test (réglage du super-admin, actif par défaut) : aucun e-mail n'est envoyé aux distributeurs du restaurant
 * (bons de commande, annulations) ; les commandes passent quand même « envoyées ». Quid Vinum reçoit les siennes.
 */
export async function modeTestDistributeurs(): Promise<boolean> {
  const [r] = await requete<{ valeur: string }>(`select valeur from reglage_serveur where cle = 'mode_test_distributeurs'`);
  return r?.valeur !== '0';
}

/** Panier de commande du restaurant (page Vins) : chaque vin, ses bouteilles, son distributeur et son prix d'achat HTVA. */
export interface LignePanier { vin_id: string; quantite: number; libelle: string; millesime: string | null; format: string | null; etiquette_url: string | null;
  fournisseur: string | null; quid_vinum: boolean; prix_achat: number | null }
export async function getPanier(resto: string) {
  return requete<LignePanier>(
    `select p.vin_id, p.quantite, v.libelle, v.millesime, v.format, v.etiquette_url, f.nom as fournisseur, f.distributeur_id is not null as quid_vinum,
            -- Distributeur Quid Vinum : le prix de son catalogue pour ce restaurant (jamais le prix QV ni la marge).
            coalesce(case when f.distributeur_id is not null then (select round(dv.prix_qv * (1 + coalesce(f.marge,
              (select case when valeur ~ '^[0-9]+([.][0-9]+)?$' then valeur::numeric end from reglage_serveur where cle = 'qv_marge'), 15) / 100), 2)
              from distributeur_vin dv where dv.id = v.distributeur_vin_id and dv.distributeur_id = f.distributeur_id) end, v.prix_achat)::float8 as prix_achat
       from panier p join vin_carte v on v.id = p.vin_id
       left join fournisseur f on f.id = coalesce(v.fournisseur_id, (select x.fournisseur_id from vin_carte x where x.restaurant_id = v.restaurant_id
                                   and lower(x.libelle) = lower(v.libelle) and x.millesime is not distinct from v.millesime and x.fournisseur_id is not null limit 1))
      where p.restaurant_id = $1 order by f.distributeur_id is null, lower(coalesce(f.nom, 'zzz')), p.ajoute_le`, [resto]);
}

/** Commande Quid Vinum acceptée (ou plus loin : envoyée au distributeur, livrée…) : le restaurant ne peut plus l'annuler. */
export const QV_VERROUILLEE = ['acceptee', 'envoyee_distributeur', 'livree_partielle', 'livree', 'facturee'];
export const commandeVerrouillee = (c: { via_qv?: boolean; statut_qv: string | null }) => Boolean(c.statut_qv && QV_VERROUILLEE.includes(c.statut_qv));

// Nouveautés d'une commande Quid Vinum pas encore vues par le restaurant : statut changé par le super-admin, ou facture jointe.
const A_VOIR = `restaurant_id = $1 and (
  (statut_qv_le is not null and coalesce(statut_qv, 'recue') <> 'recue' and statut_qv_le > coalesce(statut_qv_vu_le, '-infinity'::timestamptz))
  or exists (select 1 from facture_commande f where f.commande_id = commande.id and f.depose_le > coalesce(statut_qv_vu_le, '-infinity'::timestamptz)))`;

/** Nombre de commandes avec une nouveauté (statut, facture) depuis la dernière visite de la page Commandes (pastille du menu). */
export async function commandesAVoir(resto: string): Promise<number> {
  const [r] = await requete<{ n: number }>(`select count(*)::int as n from commande where ${A_VOIR}`, [resto]);
  return r?.n ?? 0;
}

/** Le restaurant a ouvert la page Commandes : les nouveautés sont vues. */
export async function marquerCommandesVues(resto: string): Promise<void> {
  await requete(`update commande set statut_qv_vu_le = now() where ${A_VOIR}`, [resto]);
}
