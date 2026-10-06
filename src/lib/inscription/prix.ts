// Relecture des prix des plats depuis le menu, pour un restaurant déjà inscrit (lancée par le super-admin).
// Pat relit le menu comme à l'inscription, retrouve chaque plat existant par son nom et remplit seulement son prix :
// les plats, les descriptions et les accords ne changent pas.
// File : relecture_prix.statut = 'en_attente' ; lue en arrière-plan (une requête classique est coupée vers 26 secondes).
// Sans 'server-only' : exécuté par netlify/functions/relire-prix-background.mts (et par le serveur en local).
import type { Requete } from '../generation/accords';
import { Plat, validerListe } from './donnees';
import { analyserMenu, type FichierEnvoye } from './lecture';

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'a', 'au', 'aux', 'en', 'sauce', 'avec', 'sur', 'son', 'sa', 'ses']);
const mots = (t: string) => new Set(t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe')
  .split(/[^a-z0-9]+/).filter((m) => m && !MOTS_VIDES.has(m)));

type PlatBase = { id: string; nom: string };
type PrixLu = { nom: string; prix?: number | null; prixVariantes?: string | null };

/**
 * Associe les plats lus sur le menu aux plats du restaurant : même nom (accents et ponctuation à part),
 * sinon le plus proche par les mots (au moins 60 % de mots communs). Chaque plat du restaurant reçoit au plus un prix.
 * Exporté pour les tests.
 */
export function associerPrix(plats: PlatBase[], lus: PrixLu[]) {
  const avecPrix = lus.filter((l) => l.prix != null || l.prixVariantes);
  const paires: Array<{ plat: PlatBase; lu: PrixLu; score: number }> = [];
  for (const plat of plats) {
    const a = mots(plat.nom);
    for (const lu of avecPrix) {
      const b = mots(lu.nom);
      const communs = [...a].filter((m) => b.has(m)).length;
      const score = communs / Math.max(1, new Set([...a, ...b]).size);
      if (score >= 0.6) paires.push({ plat, lu, score });
    }
  }
  paires.sort((x, y) => y.score - x.score);
  const pris = new Set<string>(), utilises = new Set<PrixLu>();
  const resultat = new Map<string, PrixLu>();
  for (const p of paires) {
    if (pris.has(p.plat.id) || utilises.has(p.lu)) continue;
    pris.add(p.plat.id); utilises.add(p.lu);
    resultat.set(p.plat.id, p.lu);
  }
  return resultat;
}

async function prendre(q: Requete): Promise<{ id: string; restaurant_id: string } | null> {
  const [r] = await q<{ id: string; restaurant_id: string }>(
    `update relecture_prix set statut = 'en_cours', maj_le = now()
      where id = (select id from relecture_prix where statut = 'en_attente' order by cree_le for update skip locked limit 1)
      returning id, restaurant_id`);
  return r ?? null;
}

export async function executerRelecture(q: Requete, id: string, restaurantId: string) {
  const finir = (statut: 'ok' | 'erreur', message: string) => Promise.all([
    q(`update relecture_prix set statut = $2, message = $3, maj_le = now() where id = $1`, [id, statut, message]),
    q('delete from relecture_prix_fichier where relecture_id = $1', [id]),
  ]);
  try {
    const fichiers = await q<FichierEnvoye>(
      'select nom, media_type as type, octets from relecture_prix_fichier where relecture_id = $1 order by cree_le, nom', [id]);
    if (!fichiers.length) throw new Error('aucun fichier');
    const { ok } = validerListe(Plat, await analyserMenu(fichiers.map((f) => ({ ...f, octets: new Uint8Array(f.octets as unknown as Buffer) }))));
    const plats = await q<PlatBase & { prix: number | null }>('select id, nom, prix from plat where restaurant_id = $1', [restaurantId]);
    const prix = associerPrix(plats, ok);
    let changes = 0;
    for (const [platId, lu] of prix) {
      const r = await q<{ id: string }>(
        `update plat set prix = coalesce($2, prix), prix_variantes = coalesce($3, prix_variantes)
          where id = $1 and (prix is distinct from coalesce($2, prix) or prix_variantes is distinct from coalesce($3, prix_variantes))
          returning id`, [platId, lu.prix ?? null, lu.prixVariantes ?? null]);
      changes += r.length;
    }
    const sans = plats.filter((p) => p.prix === null && !prix.has(p.id)).length; // ni prix avant, ni prix lu
    await finir('ok', `${ok.length} plat(s) lu(s) sur le menu · ${changes} prix mis à jour`
      + (prix.size > changes ? ` · ${prix.size - changes} déjà à jour` : '')
      + (sans ? ` · ${sans} plat(s) toujours sans prix (non retrouvés sur le menu) : à compléter à la main` : ''));
  } catch (e) {
    console.error('[prix] relecture', id, e);
    const message = e instanceof Error && (e.name === 'MauvaisDocument' || /illisible/.test(e.message)) ? e.message
      : 'Pat n’a pas réussi à lire ce menu. Essayez des images plus nettes, une par page, ou le PDF.';
    await finir('erreur', message);
  }
}

/** Traite les relectures en attente jusqu'à épuisement ou jusqu'à l'heure limite. Renvoie le nombre restant. */
export async function traiterRelecturesPrix(q: Requete, { finAvant }: { finAvant: number }) {
  for (let r = await prendre(q); r; r = Date.now() < finAvant ? await prendre(q) : null) await executerRelecture(q, r.id, r.restaurant_id);
  const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from relecture_prix where statut = 'en_attente'`);
  return n;
}
