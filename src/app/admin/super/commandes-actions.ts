'use server';
// Super-admin — suivi des commandes passées par Quid Vinum.
import { revalidatePath } from 'next/cache';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import type { Retour } from '@/components/admin/FormulaireAdmin';
import { STATUTS_QV } from '@/lib/super/commandes';
import { donneesBon, emailsCoupes } from '@/lib/admin/stocks';
import { envoyerEmail } from '@/lib/email';
import { referenceCommande } from '@/lib/bon-commande';
import { getVinsBO } from '@/lib/admin/donnees';
import { regrouperVins } from '@/app/admin/[resto]/carte/etats';

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
  // Seul le super-admin annule une commande déjà réceptionnée : ses bouteilles reçues peuvent alors être retirées du stock.
  const r = await requete<{ restaurant_id: string }>(
    `update commande set statut_qv = 'refusee', statut_qv_le = now(), motif_refus = $2, statut = 'annulee' where id = $1 and statut in ('ouverte', 'recue') returning restaurant_id`, [id, motif]);
  if (!r.length) return { erreur: 'Cette commande est déjà annulée.' };
  const resto = r[0].restaurant_id;
  let retire = 0;
  if (f.get('retirer_stock') === 'on') {
    // Le stock est porté par la ligne principale de chaque vin (comme à la réception).
    const principale = new Map<string, string>();
    for (const g of regrouperVins(await getVinsBO(resto))) for (const v of g.tous) principale.set(v.id, g.principal.id);
    for (const l of await requete<{ vin_id: string; q: number }>(
      'select vin_id, sum(recue)::int as q from commande_ligne where commande_id = $1 and vin_id is not null and recue > 0 group by vin_id', [id])) {
      await requete('update vin_carte set stock = greatest(stock - $3, 0) where id = $1 and restaurant_id = $2', [principale.get(l.vin_id) ?? l.vin_id, resto, l.q]);
      retire += l.q;
    }
  }
  await requete(
    `update vin_carte v set en_commande = greatest(v.en_commande - l.q, 0)
       from (select vin_id, sum(quantite - recue)::int as q from commande_ligne where commande_id = $1 and vin_id is not null group by vin_id) l
      where v.id = l.vin_id and v.restaurant_id = $2`, [id, resto]);
  let note = '';
  const bon = await donneesBon(resto, id);
  if (bon?.restaurant.email && !(await emailsCoupes(resto))) { // pas en vert : pas d'e-mail au restaurant
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
  return { ok: `Commande annulée.${retire ? ` ${retire} bouteille${retire > 1 ? 's' : ''} retirée${retire > 1 ? 's' : ''} du stock du restaurant.` : ''}${note}` };
}

/** Commande en attente de validation : acceptée, ou refusée avec son explication (champ « decision » : accepter / refuser). */
export async function decisionCommandeQv(id: string, f: FormData): Promise<Retour> {
  await exigerAdmin();
  const decision = String(f.get('decision') ?? '');
  if (decision === 'refuser') return refuserCommandeQv(id, f);
  if (decision !== 'accepter') return { erreur: 'Choisissez : accepter ou refuser la commande.' };
  const r = await requete<{ restaurant_id: string }>(
    // Une commande déjà réceptionnée par le restaurant peut encore être validée (elle n'a simplement plus de suite à donner).
    `update commande set statut_qv = 'acceptee', statut_qv_le = now() where id = $1 and statut in ('ouverte', 'recue') returning restaurant_id`, [id]);
  if (!r.length) return { erreur: 'Cette commande a été annulée.' };
  revalidatePath('/admin/super/commandes');
  revalidatePath(`/admin/${r[0].restaurant_id}`, 'layout');
  return { ok: 'Commande acceptée : elle passe « En cours de traitement » (le restaurant voit « Commande acceptée »).' };
}

/** Facture (PDF) d'une commande, jointe ou remplacée à tout moment : le restaurant la retrouve dans sa commande. */
export async function deposerFactureQv(id: string, f: FormData): Promise<Retour> {
  const u = await exigerAdmin();
  const fichier = f.get('facture');
  if (!(fichier instanceof File) || !fichier.size) return { erreur: 'Choisissez le PDF de la facture.' };
  if (fichier.size > 15 * 1024 * 1024) return { erreur: 'Facture trop lourde (15 Mo au maximum).' };
  const octets = Buffer.from(await fichier.arrayBuffer());
  if (octets.subarray(0, 5).toString('latin1') !== '%PDF-') return { erreur: 'La facture doit être un fichier PDF.' };
  const [c] = await requete<{ restaurant_id: string }>('select restaurant_id from commande where id = $1', [id]);
  if (!c) return { erreur: 'Commande introuvable.' };
  await requete(`insert into facture_commande (commande_id, nom, octets, taille, depose_par) values ($1, $2, $3, $4, $5)
                 on conflict (commande_id) do update set nom = excluded.nom, octets = excluded.octets, taille = excluded.taille, depose_par = excluded.depose_par, depose_le = now()`,
    [id, (fichier.name || 'facture.pdf').slice(0, 120), octets, octets.length, u.email]);
  revalidatePath('/admin/super/commandes');
  revalidatePath(`/admin/${c.restaurant_id}`, 'layout');
  return { ok: 'Facture jointe : le restaurant la retrouve dans sa commande.' };
}

/** Facture retirée d'une commande (pour en joindre une autre). */
export async function supprimerFactureQv(id: string): Promise<Retour> {
  await exigerAdmin();
  const r = await requete<{ restaurant_id: string }>(
    `delete from facture_commande f using commande c where f.commande_id = $1 and c.id = f.commande_id returning c.restaurant_id`, [id]);
  revalidatePath('/admin/super/commandes');
  if (r[0]) revalidatePath(`/admin/${r[0].restaurant_id}`, 'layout');
  return { ok: 'Facture supprimée.' };
}
