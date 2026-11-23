// Frigos connectés : les bons de commande passés à LVQNEP (le distributeur des frigos) et leurs factures.
import { requete } from '@/lib/db';

export interface CommandeFrigo {
  id: string; numero: number; cree_le: string; statut: 'ouverte' | 'recue' | 'annulee'; statut_qv: string | null;
  bouteilles: number; montant: number | null; facture_le: string | null; facture_nom: string | null;
}

/** Commandes du restaurant chez LVQNEP, les plus récentes d'abord (annulées comprises). */
export function commandesFrigo(resto: string) {
  return requete<CommandeFrigo>(
    `select c.id, c.numero, c.cree_le::text, c.statut, c.statut_qv,
            coalesce((select sum(l.quantite) from commande_ligne l where l.commande_id = c.id), 0)::int as bouteilles,
            (select sum(l.quantite * l.prix_achat) from commande_ligne l where l.commande_id = c.id)::float8 as montant,
            fc.depose_le::text as facture_le, fc.nom as facture_nom
       from commande c
       join fournisseur f on f.id = c.fournisseur_id
       join distributeur d on d.id = f.distributeur_id
       left join facture_commande fc on fc.commande_id = c.id
      where c.restaurant_id = $1 and lower(d.nom) like '%lvqnep%'
      order by c.cree_le desc`, [resto]);
}

/** Le restaurant a-t-il un frigo connecté (relié à WineMS, ou un frigo déjà reçu) ? */
export async function aDesFrigos(resto: string) {
  const [r] = await requete<{ oui: boolean }>(
    'select (r.winems_client_id is not null or exists (select 1 from frigo f where f.restaurant_id = r.id)) as oui from restaurant r where r.id = $1', [resto]);
  return Boolean(r?.oui);
}

const SUIVI_QV: Record<string, string> = { recue: 'Envoyée · en attente de validation', acceptee: 'En cours de traitement', envoyee_distributeur: 'En cours de livraison',
  livree_partielle: 'Livraison partielle', livree: 'Livrée', facturee: 'Facturée' };
/** Où en est un bon de commande, tel que le restaurant le lit. */
export const etatCommandeFrigo = (c: Pick<CommandeFrigo, 'statut' | 'statut_qv'>) =>
  c.statut === 'annulee' ? 'Annulée' : c.statut === 'recue' ? 'Reçue' : c.statut_qv ? SUIVI_QV[c.statut_qv] ?? c.statut_qv : 'Pas encore envoyée';
