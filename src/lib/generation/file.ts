/**
 * File d'attente des régénérations d'accords (table generation_accords) : une ligne par plat.
 * Le back-office crée les lignes ; un travailleur (fonction Netlify d'arrière-plan, ou le serveur local) les traite.
 */
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { regenererAccordsPlat, type Requete } from './accords';
import { clientClaude } from '../claude';

/** Une ligne restée « en cours » plus longtemps que ça vient d'un travailleur interrompu. */
const BLOQUE_APRES = "20 minutes";

/** Passe rapide de l'inscription : premiers accords publiés vite, régénérés ensuite avec Opus depuis l'admin. */
export const modeleRapide = () => process.env.ANTHROPIC_MODEL_RAPIDE ?? 'claude-sonnet-5-5';

export async function creerLot(q: Requete, restaurantId: string, platIds: string[], demandePar: string, { modele }: { modele?: string } = {}) {
  await q(`update generation_accords set statut = 'erreur', message = 'interrompu (délai dépassé)', fin_le = now()
            where statut = 'en_cours' and debut_le < now() - interval '${BLOQUE_APRES}'`);
  const lot = randomUUID();
  // Un plat déjà en attente ou en cours n'est pas demandé deux fois.
  const r = await q<{ id: number }>(
    `insert into generation_accords (lot, restaurant_id, plat_id, demande_par, modele)
     select $1, $2, p, $3, $5 from unnest($4::text[]) as p
      where not exists (select 1 from generation_accords g where g.plat_id = p and g.statut in ('en_attente', 'en_cours'))
     returning id`,
    [lot, restaurantId, demandePar, platIds, modele ?? null],
  );
  return { lot, crees: r.length };
}

interface Tache { id: number; restaurant_id: string; plat_id: string; modele: string | null }

/** Prend la prochaine tâche en attente (deux travailleurs ne prennent jamais la même). */
async function prendre(q: Requete) {
  const [t] = await q<Tache>(
    `update generation_accords set statut = 'en_cours', debut_le = now()
      where id = (select id from generation_accords where statut = 'en_attente' order by id for update skip locked limit 1)
      returning id, restaurant_id, plat_id, modele`);
  return t ?? null;
}

/**
 * Nombre de plats préparés en même temps (une fonction Netlify d'arrière-plan par plat en cours).
 * Plus haut, la génération va plus vite sans coûter plus ; la limite est le débit du compte Claude
 * (au-delà, le SDK attend et réessaie tout seul).
 */
export const PLATS_EN_PARALLELE = 6;

/**
 * Refus passager de l'API sans explication (« 403 status code (no body) ») : il ne vient pas d'un vrai refus
 * d'accès (qui porte un message), mais d'une couche intermédiaire. Le SDK ne le réessaie pas : on le fait ici,
 * deux fois, après 30 puis 90 secondes, si le temps de la fonction le permet.
 */
export function refusPassager(e: unknown) {
  const err = e as { status?: number; error?: unknown; message?: string } | null;
  return err?.status === 403 && (!err.error || /no body/i.test(err.message ?? ''));
}

async function avecReprises<T>(f: () => Promise<T>, finAvant: number, quoi: string): Promise<T> {
  for (const attente of [30_000, 90_000]) {
    try {
      return await f();
    } catch (e) {
      if (!refusPassager(e) || Date.now() + attente + 120_000 > finAvant) throw e;
      console.warn(`[accords] ${quoi} : refus passager (403 sans message), nouvel essai dans ${attente / 1000} s`);
      await new Promise((r) => setTimeout(r, attente));
    }
  }
  return f();
}

/**
 * Traite les tâches en attente jusqu'à épuisement ou jusqu'à l'heure limite.
 * Renvoie le nombre de tâches encore en attente (à reprendre par un autre passage).
 */
export async function travailler(q: Requete, { finAvant, modele = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5', client = clientClaude({ maxRetries: 6 }) }: { finAvant: number; modele?: string; client?: Anthropic }) {
  for (;;) {
    for (let t: Tache | null = await prendre(q); t; t = Date.now() < finAvant ? await prendre(q) : null) {
      try {
        const b = await avecReprises(() => regenererAccordsPlat(q, client!, t!.restaurant_id, t!.plat_id, t!.modele ?? modele), finAvant, t.plat_id);
        const message = `${b.ecrits} accord${b.ecrits > 1 ? 's' : ''} écrit${b.ecrits > 1 ? 's' : ''}`
          + (b.imposes ? `, ${b.imposes} note${b.imposes > 1 ? 's' : ''} modifiée${b.imposes > 1 ? 's' : ''} à la main gardée${b.imposes > 1 ? 's' : ''}` : '')
          + (b.aRevoir.length ? ` ; inchangés (réponse à revoir) : ${b.aRevoir.join(', ')}` : '');
        await q(`update generation_accords set statut = 'fait', message = $2, fin_le = now() where id = $1`, [t.id, message]);
        console.log(`[accords] ${t.plat_id} : ${message} (jetons ${b.jetonsEntree} + ${b.jetonsSortie})`);
      } catch (e) {
        await q(`update generation_accords set statut = 'erreur', message = $2, fin_le = now() where id = $1`, [t.id, String((e as Error).message ?? e).slice(0, 500)]);
        console.error(`[accords] ${t.plat_id} : échec`, e);
      }
    }
    // Restaurants en mise en place : en service quand tout est prêt ; sinon les plats manquants repartent dans la file.
    if (!(await finirMisesEnPlace(q)) || Date.now() >= finAvant) break;
  }
  const [r] = await q<{ n: number }>(`select count(*)::int as n from generation_accords where statut = 'en_attente'`);
  return r.n;
}

/** Relances automatiques des plats sans accord d'un restaurant inscrit, avant de laisser la main au super-admin. */
export const RELANCES_AUTO = 2;

/**
 * Règle « prêt à publier » des restaurants en mise en place (plus aucune génération en cours) :
 * - tous les plats actifs ont au moins un accord → le restaurant passe en service (QR code et app ouverts) ;
 * - sinon, pour un restaurant inscrit seul, les plats sans accord sont relancés (RELANCES_AUTO fois au plus) ; ensuite il reste en mise en place
 *   et le super-admin voit les plats en échec (« Relancer la préparation »).
 * Renvoie le nombre de plats remis dans la file.
 */
export async function finirMisesEnPlace(q: Requete): Promise<number> {
  const restos = await q<{ id: string; origine: string; manquants: string[]; relances: number }>(
    `select r.id, r.origine,
            array(select pl.id from plat pl where pl.restaurant_id = r.id and pl.actif
                    and not exists (select 1 from accord a where a.plat_id = pl.id) order by pl.ordre) as manquants,
            (select count(distinct g.lot)::int from generation_accords g where g.restaurant_id = r.id and g.demande_par = 'relance-auto') as relances
       from restaurant r
      where r.statut = 'mise_en_place'
        and exists (select 1 from plat pl where pl.restaurant_id = r.id and pl.actif)
        and exists (select 1 from generation_accords g where g.restaurant_id = r.id)
        and not exists (select 1 from generation_accords g where g.restaurant_id = r.id and g.statut in ('en_attente', 'en_cours'))`);
  let remis = 0;
  for (const r of restos) {
    if (!r.manquants.length) {
      await q(`update restaurant set statut = 'en_service' where id = $1 and statut = 'mise_en_place'`, [r.id]);
    } else if (r.origine === 'inscription' && r.relances < RELANCES_AUTO) {
      remis += (await creerLot(q, r.id, r.manquants, 'relance-auto', { modele: modeleRapide() })).crees;
      console.log(`[accords] ${r.id} : ${r.manquants.length} plat(s) sans accord, relance automatique ${r.relances + 1}/${RELANCES_AUTO}`);
    }
  }
  return remis;
}

export interface EtatLot { lot: string; total: number; attente: number; enCours: number; faits: number; erreurs: { plat_id: string; message: string | null }[]; demande_le: string; termine: boolean }

/** État de la dernière régénération demandée pour un restaurant (pour la page Accords). */
export async function etatDernierLot(q: Requete, restaurantId: string): Promise<EtatLot | null> {
  const lignes = await q<{ lot: string; plat_id: string; statut: string; message: string | null; cree_le: string }>(
    `select lot, plat_id, statut, message, cree_le from generation_accords
      where lot = (select lot from generation_accords where restaurant_id = $1 order by cree_le desc, id desc limit 1)`, [restaurantId]);
  if (!lignes.length) return null;
  const n = (s: string) => lignes.filter((l) => l.statut === s).length;
  return {
    lot: lignes[0].lot, total: lignes.length, attente: n('en_attente'), enCours: n('en_cours'), faits: n('fait'),
    erreurs: lignes.filter((l) => l.statut === 'erreur').map((l) => ({ plat_id: l.plat_id, message: l.message })),
    demande_le: lignes[0].cree_le, termine: n('en_attente') + n('en_cours') === 0,
  };
}
