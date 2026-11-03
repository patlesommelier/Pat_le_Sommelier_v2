'use server';
// « Trouver un vin » : la demande du restaurant est enregistrée, puis Pat cherche en arrière-plan (la page suit l'avancement).
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requete } from '@/lib/db';
import { exigerAcces } from '@/lib/admin/auth';
import { chercherVins } from '@/lib/recherche-vin';

const txt = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };

export async function lancerRechercheVin(resto: string, f: FormData) {
  const u = await exigerAcces(resto);
  const page = `/admin/${resto}/trouver-vin`;
  const demande = txt(f, 'demande');
  const platId = txt(f, 'plat');
  if (!demande && !platId) redirect(`${page}?${new URLSearchParams({ erreur: 'Décrivez ce que vous cherchez, ou choisissez un plat de votre menu.' })}`);
  const budget = txt(f, 'budget') ? Number(txt(f, 'budget')!.replace(',', '.')) : null;
  const couleur = txt(f, 'couleur');
  const [plat] = platId ? await requete<{ id: string; nom: string }>('select id, nom from plat where id = $1 and restaurant_id = $2', [platId, resto]) : [];
  const id = randomUUID();
  await requete(`insert into recherche_vin (id, restaurant_id, demande, plat_id, budget, couleur, cree_par) values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, resto, (demande ?? `Un vin pour accompagner « ${plat?.nom ?? 'ce plat'} »`).slice(0, 2000), plat?.id ?? null,
      budget && Number.isFinite(budget) && budget > 0 ? budget : null, couleur && /^(bulles|blanc|rose|orange|rouge|doux)$/.test(couleur) ? couleur : null, u.email]);
  void chercherVins(requete, id);
  revalidatePath(page);
  redirect(`${page}?${new URLSearchParams({ r: id })}`);
}
