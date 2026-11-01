'use server';
// Super-admin — suivi des commandes passées par Quid Vinum.
import { revalidatePath } from 'next/cache';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import type { Retour } from '@/components/admin/FormulaireAdmin';
import { STATUTS_QV } from '@/lib/super/commandes';

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
