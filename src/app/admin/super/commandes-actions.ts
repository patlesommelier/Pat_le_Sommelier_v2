'use server';
// Super-admin — suivi des commandes passées par Quid Vinum.
import { revalidatePath } from 'next/cache';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import type { Retour } from '@/components/admin/FormulaireAdmin';
import { STATUTS_QV } from '@/lib/super/commandes';
import { donneesBon } from '@/lib/admin/stocks';
import { envoyerEmail } from '@/lib/email';
import { referenceCommande } from '@/lib/bon-commande';

export async function changerStatutQv(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const statut = String(f.get('statut_qv') ?? '');
  if (!STATUTS_QV.some(([k]) => k === statut)) return { erreur: 'Statut inconnu.' };
  const r = await requete<{ restaurant_id: string }>('update commande set statut_qv = $2, statut_qv_le = now() where id = $1 returning restaurant_id', [id, statut]);
  if (!r.length) return { erreur: 'Commande introuvable.' };
  revalidatePath('/admin/super/commandes');
  revalidatePath(`/admin/${r[0].restaurant_id}/commandes`);
  return { ok: `Statut : ${STATUTS_QV.find(([k]) => k === statut)![1]}.` };
}

/**
 * Commande refusée par Quid Vinum, avec son motif : elle est annulée chez le restaurant (ses bouteilles ne sont plus « en commande »),
 * qui voit le motif sur sa commande et le reçoit par e-mail.
 */
export async function refuserCommandeQv(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const motif = String(f.get('motif') ?? '').trim().slice(0, 500);
  if (!motif) return { erreur: 'Expliquez en quelques mots pourquoi la commande est refusée.' };
  const r = await requete<{ restaurant_id: string }>(
    `update commande set statut_qv = 'refusee', statut_qv_le = now(), motif_refus = $2, statut = 'annulee' where id = $1 and statut = 'ouverte' returning restaurant_id`, [id, motif]);
  if (!r.length) return { erreur: 'Cette commande n’est plus ouverte (déjà réceptionnée ou annulée).' };
  const resto = r[0].restaurant_id;
  await requete(
    `update vin_carte v set en_commande = greatest(v.en_commande - l.q, 0)
       from (select vin_id, sum(quantite - recue)::int as q from commande_ligne where commande_id = $1 and vin_id is not null group by vin_id) l
      where v.id = l.vin_id and v.restaurant_id = $2`, [id, resto]);
  let note = '';
  const bon = await donneesBon(resto, id);
  if (bon?.restaurant.email) {
    const ref = referenceCommande(bon);
    const erreur = await envoyerEmail({
      a: bon.restaurant.email, sujet: `Commande ${ref} refusée par Quid Vinum`,
      texte: `Bonjour,\n\nQuid Vinum ne peut pas donner suite à votre commande n° ${ref} :\n\n${motif}\n\n`
        + bon.lignes.map((l) => `- ${l.quantite} × ${l.libelle}`).join('\n') + '\n\nLa commande est annulée ; vous pouvez en passer une nouvelle depuis Commandes.\n\nQuid Vinum',
    });
    note = erreur ? ` (e-mail au restaurant non envoyé : ${erreur})` : ' Le restaurant est prévenu par e-mail.';
  }
  revalidatePath('/admin/super/commandes');
  revalidatePath(`/admin/${resto}`, 'layout');
  return { ok: `Commande refusée.${note}` };
}
