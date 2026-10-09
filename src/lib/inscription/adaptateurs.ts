// Pat le sommelier — points de raccordement du parcours d'inscription avec le reste de l'app.
// Lecture du menu et de la carte (Claude lit les photos et les PDF), rapprochement avec la base de Pat,
// création des producteurs proposés et lancement de la préparation des accords (file existante).
import 'server-only';
import { requete } from '../db';
import { creerLot, modeleRapide, PLATS_EN_PARALLELE, travailler } from '../generation/file';
import { creerLotPresentations, presentationsManquantes, travaillerPresentations } from '../generation/file-presentations';
import type { Plat, Vin, VinRapproche } from './donnees';
import { mots, norm, producteurConnu, rapprocherVins as rapprocher } from './lecture';

export type { FichierEnvoye } from './lecture';
export { analyserCarte, analyserMenu } from './lecture';

/** Rattache chaque vin à la base de Pat (producteur reconnu ou nouveau). Aucun ranking ne sort d'ici. */
export const rapprocherVins = (vins: Vin[]): Promise<VinRapproche[]> => rapprocher(requete, vins);

const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/**
 * Crée les producteurs inconnus au statut « proposé » (file « Producteurs à valider » du super-admin)
 * et renvoie, pour chaque vin de la carte, l'identifiant de son producteur (null si la carte ne l'indique pas).
 */
export async function creerVinsEnAttente(_restaurantId: string, vins: VinRapproche[]): Promise<Array<string | null>> {
  const crees = new Map<string, string>();
  const out: Array<string | null> = [];
  for (const v of vins) {
    if (v.vinId) { out.push(v.vinId); continue; }
    if (!v.producteur) { out.push(null); continue; }
    const cle = mots(v.producteur).join('-') || slug(v.producteur);
    if (!crees.has(cle)) {
      const existant = await producteurConnu(requete, v.producteur);
      const id = existant?.id ?? `inscription-prod-${slug(v.producteur)}`;
      if (!existant) {
        await requete(
          `insert into producteur (id, nom, region, statut, source, a_verifier) values ($1, $2, $3, 'propose', 'inscription', $4)
           on conflict (id) do nothing`,
          [id, v.producteur, v.region, `Repéré sur une carte à l'inscription : ${v.libelleCarte}${v.appellation ? ` (${v.appellation})` : ''}`]);
      }
      crees.set(cle, id);
    }
    out.push(crees.get(cle)!);
  }
  return out;
}

/** Adresse publique du site, pour réveiller les fonctions d'arrière-plan depuis le serveur. */
const origineSite = () => (process.env.URL ?? process.env.URL_PUBLIQUE ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/**
 * Prépare les accords d'un restaurant : une tâche par plat dans la file des régénérations (Pat note chaque vin
 * sur chaque plat), puis les présentations de la carte imprimable. Les tâches sont traitées par les fonctions
 * Netlify d'arrière-plan ; hors Netlify (développement local), par le serveur lui-même.
 * L'avancement se lit dans la file (etatDernierLot) ; le restaurant passe « en service » à la fin (voir travailler).
 */
export async function preparerAccords(restaurantId: string, demandePar = 'inscription', { seulementManquants = false } = {}): Promise<void> {
  // Relance : seulement les plats sans accord ou en échec à la dernière préparation (pas de nouvel appel pour les autres).
  const plats = await requete<{ id: string }>(
    `select pl.id from plat pl where pl.restaurant_id = $1 and pl.actif
        and (not $2 or not exists (select 1 from accord a where a.plat_id = pl.id)
             or exists (select 1 from generation_accords g where g.plat_id = pl.id and g.statut = 'erreur'
                          and g.lot = (select lot from generation_accords where restaurant_id = $1 order by cree_le desc, id desc limit 1)))
      order by pl.ordre`, [restaurantId, seulementManquants]);
  await lancerPreparation(restaurantId, plats.map((p) => p.id), demandePar);
}

/**
 * Accords (passe rapide) des plats donnés, puis présentations des vins qui n'en ont pas, en arrière-plan.
 * `vins` : seulement ces vins (vin ajouté par le restaurant) ; les accords des autres vins ne changent pas.
 */
export async function lancerPreparation(restaurantId: string, platIds: string[], demandePar: string, { vins }: { vins?: string[] } = {}) {
  // Passe rapide (Sonnet) : le restaurant a ses accords en quelques minutes ; Pat les régénère ensuite avec Opus depuis l'admin.
  const { crees } = await creerLot(requete, restaurantId, platIds, demandePar, { modele: modeleRapide(), vins });
  const manquantes = await presentationsManquantes(requete, restaurantId);
  const presentations = manquantes.length ? await creerLotPresentations(requete, restaurantId, manquantes.map((m) => m.couleur), demandePar) : 0;
  const base = origineSite();
  const appeler = (fonction: string, n: number) => Promise.all(Array.from({ length: Math.min(PLATS_EN_PARALLELE, n) }, () =>
    base ? fetch(`${base}/.netlify/functions/${fonction}`, { method: 'POST' }).then((r) => r.status).catch(() => 0) : Promise.resolve(0)));
  const [accords, pres] = await Promise.all([appeler('generer-accords-background', crees), appeler('generer-presentations-background', presentations)]);
  const lance = (s: number[]) => s.some((x) => x === 202 || x === 200);
  // Hors Netlify : le serveur traite les files lui-même, sans faire attendre la page.
  if (crees && !lance(accords)) void travailler(requete, { finAvant: Date.now() + 60 * 60 * 1000 }).catch((e) => console.error('[inscription]', e));
  if (presentations && !lance(pres)) void travaillerPresentations(requete, { finAvant: Date.now() + 60 * 60 * 1000 }).catch((e) => console.error('[inscription]', e));
}

export type { Plat };
