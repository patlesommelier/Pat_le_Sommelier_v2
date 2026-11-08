import 'server-only';
// Super-admin — commandes des restaurants passées par Quid Vinum (distributeurs de la base de Quid Vinum).
import { requete } from '@/lib/db';

// Suivi d'une commande Quid Vinum après sa validation, dans cet ordre (les clés restent celles de la base).
export const STATUTS_QV = [['recue', 'En attente de validation'], ['acceptee', 'En cours de traitement'], ['envoyee_distributeur', 'En cours de livraison'],
  ['livree_partielle', 'Livraison partielle'], ['livree', 'Commande livrée'], ['facturee', 'Bouteilles facturées']] as const;

export interface CommandeQv {
  id: string; numero: number; cree_le: string; envoyee_le: string | null; statut: string; reference_interne: string | null; facture_le: string | null; statut_qv: string | null; statut_qv_le: string | null; motif_refus: string | null;
  restaurant_id: string; restaurant: string; destinataire: string;
  lignes: { libelle: string; detail: string | null; quantite: number; recue: number; prix_achat: number | null; prix_qv: number | null; distributeur: string | null;
    etiquette: string | null; logo: string | null }[];
}

/** Commandes passées par Quid Vinum (la plus récente d'abord) ; prix du restaurant, et prix QV du tarif actuel (super-admin seulement). */
export async function commandesQv(statut?: string) {
  const commandes = await requete<Omit<CommandeQv, 'lignes'>>(
    `select c.id, c.numero, c.cree_le::text, c.envoyee_le::text, c.statut, c.reference_interne,
            (select fc.depose_le::text from facture_commande fc where fc.commande_id = c.id) as facture_le, c.statut_qv, c.statut_qv_le::text, c.motif_refus, c.restaurant_id, r.nom as restaurant,
            case when c.quid_vinum then 'Quid Vinum (plusieurs distributeurs)' else coalesce(f.nom, c.fournisseur_nom) end as destinataire
       from commande c join restaurant r on r.id = c.restaurant_id left join fournisseur f on f.id = c.fournisseur_id
      where (c.quid_vinum or f.distributeur_id is not null
             or exists (select 1 from commande_ligne l where l.commande_id = c.id and l.distributeur_vin_id is not null)) -- distributeur retiré depuis
        -- Une commande annulée par le restaurant quitte l'onglet de son suivi (reçue, acceptée…) pour « Annulées ».
        -- Par défaut (pas de statut) : les commandes ouvertes, ni réceptionnées (clôturées) ni annulées ; « toutes » : sans filtre.
        and (($1::text is null and c.statut = 'ouverte') or $1 = 'toutes' or ($1 = 'a_envoyer' and c.envoyee_le is null and c.statut = 'ouverte')
             or (c.statut_qv = $1 and ($1 = 'refusee' or c.statut <> 'annulee'))
             or ($1 = 'annulee' and c.statut = 'annulee' and c.statut_qv is distinct from 'refusee'))
      order by c.cree_le desc limit 300`, [statut || null]);
  const lignes = commandes.length ? await requete<CommandeQv['lignes'][number] & { commande_id: string }>(
    `select l.commande_id, l.libelle, l.detail, l.quantite, l.recue, l.prix_achat::float8 as prix_achat, v.prix_qv::float8 as prix_qv, d.nom as distributeur,
            coalesce(vc.etiquette_url, v.etiquette_url, cu.etiquette_url) as etiquette, d.logo_url as logo
       from commande_ligne l left join distributeur_vin v on v.id = l.distributeur_vin_id left join distributeur d on d.id = v.distributeur_id
       left join vin_carte vc on vc.id = l.vin_id left join cuvee cu on cu.id = coalesce(vc.cuvee_id, v.cuvee_id)
      where l.commande_id = any($1) order by l.ordre`, [commandes.map((c) => c.id)]) : [];
  return commandes.map((c) => ({ ...c, lignes: lignes.filter((l) => l.commande_id === c.id) })) as CommandeQv[];
}

/** Commandes des restaurants à leurs propres distributeurs (hors Quid Vinum), pour information : la plus récente d'abord. */
export interface CommandeHorsQv {
  id: string; numero: number; cree_le: string; envoyee_le: string | null; recue_le: string | null; statut: string; reference_interne: string | null;
  restaurant_id: string; restaurant: string; fournisseur: string; facture_le: string | null;
  lignes: { libelle: string; detail: string | null; quantite: number; recue: number; prix_achat: number | null }[];
}
export async function commandesHorsQv() {
  const commandes = await requete<Omit<CommandeHorsQv, 'lignes'>>(
    `select c.id, c.numero, c.cree_le::text, c.envoyee_le::text, c.recue_le::text, c.statut, c.reference_interne, c.restaurant_id, r.nom as restaurant,
            coalesce(f.nom, c.fournisseur_nom) as fournisseur, (select fc.depose_le::text from facture_commande fc where fc.commande_id = c.id) as facture_le
       from commande c join restaurant r on r.id = c.restaurant_id left join fournisseur f on f.id = c.fournisseur_id
      where not c.quid_vinum and f.distributeur_id is null
        and not exists (select 1 from commande_ligne l where l.commande_id = c.id and l.distributeur_vin_id is not null)
      order by c.cree_le desc limit 300`);
  const lignes = commandes.length ? await requete<CommandeHorsQv['lignes'][number] & { commande_id: string }>(
    `select commande_id, libelle, detail, quantite, recue, prix_achat::float8 as prix_achat from commande_ligne where commande_id = any($1) order by ordre`,
    [commandes.map((c) => c.id)]) : [];
  return commandes.map((c) => ({ ...c, lignes: lignes.filter((l) => l.commande_id === c.id) })) as CommandeHorsQv[];
}
