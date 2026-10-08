// Comparaison de modèles Claude sur les accords de quelques plats, sans rien modifier :
// chaque génération se fait dans une transaction annulée à la fin ; seuls les résultats sont gardés.
// Sans 'server-only' : utilisé par la fonction Netlify d'arrière-plan et par scripts/comparer-modeles.ts.
import type pg from 'pg';
import { clientClaude } from '../claude';
import { regenererAccordsPlat } from './accords';

export type LigneComparee = { vin_id: string; libelle: string; note: number; commentaire: string | null };
export type ResultatModele = { lignes: LigneComparee[]; jetonsEntree: number; jetonsSortie: number; duree: number; erreur?: string };
export type ResultatComparaison = { plats: { id: string; nom: string; modeles: Record<string, ResultatModele> }[] };

export async function comparerModeles(pool: pg.Pool, restaurant: string, plats: string[], modeles: string[]): Promise<ResultatComparaison> {
  const client = clientClaude({ maxRetries: 4 });
  const resultat: ResultatComparaison = { plats: [] };
  for (const plat of plats) {
    const { rows: [p] } = await pool.query<{ nom: string }>('select nom from plat where id = $1 and restaurant_id = $2', [plat, restaurant]);
    const entree: ResultatComparaison['plats'][number] = { id: plat, nom: p?.nom ?? plat, modeles: {} };
    for (const modele of modeles) {
      const c = await pool.connect();
      const q = async <T,>(sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows as T[];
      const debut = Date.now();
      try {
        await c.query('begin');
        const b = await regenererAccordsPlat(q, client, restaurant, plat, modele);
        const lignes = await q<LigneComparee>(
          `select a.vin_id, v.libelle, a.note, coalesce(a.explication_longue, a.explication) as commentaire
             from accord a join vin_carte v on v.id = a.vin_id where a.plat_id = $1 order by a.note desc, v.ordre`, [plat]);
        entree.modeles[modele] = { lignes, jetonsEntree: b.jetonsEntree, jetonsSortie: b.jetonsSortie, duree: Math.round((Date.now() - debut) / 1000) };
      } catch (e) {
        entree.modeles[modele] = { lignes: [], jetonsEntree: 0, jetonsSortie: 0, duree: Math.round((Date.now() - debut) / 1000), erreur: String((e as Error).message ?? e).slice(0, 300) };
      } finally {
        await c.query('rollback').catch(() => {}); // rien n'est gardé dans les accords
        c.release();
      }
    }
    resultat.plats.push(entree);
  }
  return resultat;
}

/** Traite les comparaisons demandées depuis le super-admin (file comparaison_modeles). */
export async function traiterComparaisons(pool: pg.Pool, { finAvant }: { finAvant: number }) {
  type Demande = { id: string; restaurant_id: string; plats: string[]; modeles: string[] };
  const prendre = async (): Promise<Demande | null> => (await pool.query<Demande>(
    `update comparaison_modeles set statut = 'en_cours', maj_le = now()
      where id = (select id from comparaison_modeles where statut = 'en_attente' order by cree_le for update skip locked limit 1)
      returning id, restaurant_id, plats, modeles`)).rows[0] ?? null;
  for (let t = await prendre(); t; t = Date.now() < finAvant ? await prendre() : null) {
    try {
      const r = await comparerModeles(pool, t.restaurant_id, t.plats, t.modeles);
      await pool.query(`update comparaison_modeles set statut = 'fait', resultat = $2, maj_le = now() where id = $1`, [t.id, JSON.stringify(r)]);
    } catch (e) {
      await pool.query(`update comparaison_modeles set statut = 'erreur', message = $2, maj_le = now() where id = $1`, [t.id, String((e as Error).message ?? e).slice(0, 500)]);
    }
  }
}
