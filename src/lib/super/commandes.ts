import 'server-only';
// Super-admin — commandes des restaurants passées par Quid Vinum (distributeurs de la base de Quid Vinum).
import { requete } from '@/lib/db';

export const STATUTS_QV = [['recue', 'Commande reçue par QV'], ['acceptee', 'Commande acceptée par QV'], ['envoyee_distributeur', 'Commande envoyée au distributeur'],
  ['livree', 'Bouteilles livrées'], ['facturee', 'Bouteilles facturées']] as const;

export interface CommandeQv {
  id: string; numero: number; cree_le: string; envoyee_le: string | null; statut: string; statut_qv: string | null; statut_qv_le: string | null;
  restaurant_id: string; restaurant: string; destinataire: string;
  lignes: { libelle: string; detail: string | null; quantite: number; recue: number; prix_achat: number | null; prix_qv: number | null; distributeur: string | null }[];
}

/** Commandes passées par Quid Vinum (la plus récente d'abord) ; prix du restaurant, et prix QV du tarif actuel (super-admin seulement). */
export async function commandesQv(statut?: string) {
  const commandes = await requete<Omit<CommandeQv, 'lignes'>>(
    `select c.id, c.numero, c.cree_le::text, c.envoyee_le::text, c.statut, c.statut_qv, c.statut_qv_le::text, c.restaurant_id, r.nom as restaurant,
            case when c.quid_vinum then 'Quid Vinum (plusieurs distributeurs)' else coalesce(f.nom, c.fournisseur_nom) end as destinataire
       from commande c join restaurant r on r.id = c.restaurant_id left join fournisseur f on f.id = c.fournisseur_id
      where (c.quid_vinum or f.distributeur_id is not null)
        and ($1::text is null or ($1 = 'a_envoyer' and c.envoyee_le is null and c.statut = 'ouverte') or c.statut_qv = $1 or ($1 = 'annulee' and c.statut = 'annulee'))
      order by c.cree_le desc limit 300`, [statut || null]);
  const lignes = commandes.length ? await requete<CommandeQv['lignes'][number] & { commande_id: string }>(
    `select l.commande_id, l.libelle, l.detail, l.quantite, l.recue, l.prix_achat::float8 as prix_achat, v.prix_qv::float8 as prix_qv, d.nom as distributeur
       from commande_ligne l left join distributeur_vin v on v.id = l.distributeur_vin_id left join distributeur d on d.id = v.distributeur_id
      where l.commande_id = any($1) order by l.ordre`, [commandes.map((c) => c.id)]) : [];
  return commandes.map((c) => ({ ...c, lignes: lignes.filter((l) => l.commande_id === c.id) })) as CommandeQv[];
}
