/**
 * File d'attente des présentations de la carte imprimée (table generation_presentations) : une ligne par couleur.
 * Le bouton « Imprimer la carte » crée les lignes pour les couleurs où des vins n'ont pas encore de présentation ;
 * un travailleur (fonction Netlify d'arrière-plan, ou le serveur local) les traite.
 * Seules les présentations manquantes sont écrites : un texte existant ou corrigé par le restaurant n'est jamais touché.
 */
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import type { Requete } from './accords';
import { genererPresentations, SQL_VINS_A_PRESENTER, type VinPresentation } from './presentations';
import { clientClaude } from '../claude';

/** Une ligne restée « en cours » plus longtemps que ça vient d'un travailleur interrompu. */
const BLOQUE_APRES = '20 minutes';
const MANQUANTS = `${SQL_VINS_A_PRESENTER} and v.presentation_carte is null`;

/** Nombre de vins disponibles sans présentation, par couleur. */
export async function presentationsManquantes(q: Requete, restaurantId: string) {
  return q<{ couleur: string; n: number }>(`select couleur, count(*)::int as n from (${MANQUANTS}) m group by couleur order by couleur`, [restaurantId]);
}

/** Crée une tâche par couleur à compléter (sauf celles déjà en attente ou en cours). Renvoie le nombre de tâches créées. */
export async function creerLotPresentations(q: Requete, restaurantId: string, couleurs: string[], demandePar: string) {
  await q(`update generation_presentations set statut = 'erreur', message = 'interrompu (délai dépassé)', fin_le = now()
            where statut = 'en_cours' and debut_le < now() - interval '${BLOQUE_APRES}'`);
  await q(`update generation_presentations set statut = 'erreur', message = 'jamais démarrée : la fonction d’arrière-plan Netlify ne s’est pas lancée', fin_le = now()
            where statut = 'en_attente' and cree_le < now() - interval '${BLOQUE_APRES}'`);
  const r = await q<{ id: number }>(
    `insert into generation_presentations (lot, restaurant_id, couleur, demande_par)
     select $1, $2, c, $3 from unnest($4::text[]) as c
      where not exists (select 1 from generation_presentations g
                         where g.restaurant_id = $2 and g.couleur = c and g.statut in ('en_attente', 'en_cours'))
     returning id`,
    [randomUUID(), restaurantId, demandePar, couleurs],
  );
  return r.length;
}

interface Tache { id: number; restaurant_id: string; couleur: string }

/** Prend la prochaine tâche en attente (deux travailleurs ne prennent jamais la même). */
async function prendre(q: Requete) {
  const [t] = await q<Tache>(
    `update generation_presentations set statut = 'en_cours', debut_le = now()
      where id = (select id from generation_presentations where statut = 'en_attente' order by id for update skip locked limit 1)
      returning id, restaurant_id, couleur`);
  return t ?? null;
}

/**
 * Traite les tâches en attente jusqu'à épuisement ou jusqu'à l'heure limite.
 * Renvoie le nombre de tâches encore en attente (à reprendre par un autre passage).
 */
export async function travaillerPresentations(q: Requete, { finAvant, modele = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5', client = clientClaude() }: { finAvant: number; modele?: string; client?: Anthropic }) {
  for (let t: Tache | null = await prendre(q); t; t = Date.now() < finAvant ? await prendre(q) : null) {
    try {
      const [r] = await q<{ nom: string }>('select nom from restaurant where id = $1', [t.restaurant_id]);
      const vins = await q<VinPresentation>(`${MANQUANTS} and v.couleur::text = $2 order by v.ordre`, [t.restaurant_id, t.couleur]);
      const existants = await q<{ couleur: string; texte: string }>(
        `select couleur::text as couleur, coalesce(presentation_carte_perso, presentation_carte) as texte from vin_carte
          where restaurant_id = $1 and couleur::text = $2 and disponible and coalesce(presentation_carte_perso, presentation_carte) is not null`,
        [t.restaurant_id, t.couleur]);
      const textes = vins.length ? await genererPresentations(vins, r?.nom ?? t.restaurant_id, client, modele, { existants }) : {};
      // « is null » : un texte saisi par le restaurant pendant la génération n'est pas écrasé.
      for (const [id, texte] of Object.entries(textes)) {
        await q('update vin_carte set presentation_carte = $3 where restaurant_id = $1 and id = $2 and presentation_carte is null', [t.restaurant_id, id, texte]);
      }
      const message = `${Object.keys(textes).length}/${vins.length}`;
      await q(`update generation_presentations set statut = 'fait', message = $2, fin_le = now() where id = $1`, [t.id, message]);
      console.log(`[presentations] ${t.restaurant_id} ${t.couleur} : ${message}`);
    } catch (e) {
      await q(`update generation_presentations set statut = 'erreur', message = $2, fin_le = now() where id = $1`, [t.id, String((e as Error).message ?? e).slice(0, 500)]);
      console.error(`[presentations] ${t.restaurant_id} ${t.couleur} : échec`, e);
    }
  }
  const [r] = await q<{ n: number }>(`select count(*)::int as n from generation_presentations where statut = 'en_attente'`);
  return r.n;
}

export interface EtatPresentations {
  couleurs: { couleur: string; statut: string; message: string | null; cree_le: string }[];
  termine: boolean; demande_le: string;
}

/** État de la dernière préparation demandée pour un restaurant (page d'attente avant l'impression). */
export async function etatPresentations(q: Requete, restaurantId: string): Promise<EtatPresentations | null> {
  const lignes = await q<{ couleur: string; statut: string; message: string | null; cree_le: string }>(
    `select couleur, statut, message, cree_le from generation_presentations
      where lot = (select lot from generation_presentations where restaurant_id = $1 order by cree_le desc, id desc limit 1)
      order by id`, [restaurantId]);
  if (!lignes.length) return null;
  return {
    couleurs: lignes.map(({ couleur, statut, message, cree_le }) => ({ couleur, statut, message, cree_le })),
    termine: lignes.every((l) => l.statut === 'fait' || l.statut === 'erreur'),
    demande_le: lignes[0].cree_le,
  };
}

/** Une tâche de ce restaurant est-elle en attente ou en cours ? */
export async function preparationEnCours(q: Requete, restaurantId: string) {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from generation_presentations where restaurant_id = $1 and statut in ('en_attente', 'en_cours')`, [restaurantId]);
  return r.n > 0;
}
