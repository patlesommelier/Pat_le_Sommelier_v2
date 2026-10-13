// Suggestions du moment : le restaurant envoie une photo (ou un PDF) de ses suggestions ; Pat lit les plats
// en arrière-plan, les ajoute au menu dans la catégorie « Suggestions » (en remplaçant les précédentes si demandé)
// et lance la préparation de leurs accords. Sans « server-only » : utilisé par une fonction Netlify d'arrière-plan.
import type { Requete } from './generation/accords';
import { creerLot, modeleRapide } from './generation/file';
import { dedoublonnerPlats, Plat, validerListe } from './inscription/donnees';
import { analyserMenu, type FichierEnvoye } from './inscription/lecture';

const slug = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/** Lit une demande en attente (la plus ancienne) ; renvoie les plats créés (à préparer), ou null s'il n'y avait rien. */
async function lireUne(q: Requete): Promise<{ restaurantId: string; platIds: string[]; demandePar: string } | null> {
  // Une lecture abandonnée (fonction arrêtée) depuis plus de 15 minutes est reprise.
  await q(`update lecture_suggestions set statut = 'a_lire' where statut = 'en_cours' and maj_le < now() - interval '15 minutes'`);
  const [l] = await q<{ id: string; restaurant_id: string; remplacer: boolean; demande_par: string | null }>(
    `update lecture_suggestions set statut = 'en_cours', maj_le = now()
      where id = (select id from lecture_suggestions where statut = 'a_lire' order by cree_le limit 1 for update skip locked)
      returning id, restaurant_id, remplacer, demande_par`);
  if (!l) return null;
  try {
    const fichiers = await q<{ nom: string; type: string; octets: Buffer }>(
      'select nom, media_type as type, octets from lecture_suggestions_fichier where lecture_id = $1 order by ordre', [l.id]);
    const lus: FichierEnvoye[] = fichiers.map((f) => ({ nom: f.nom, type: f.type, octets: new Uint8Array(f.octets) }));
    const { ok } = validerListe(Plat, await analyserMenu(lus));
    const plats = dedoublonnerPlats(ok);
    if (!plats.length) throw new Error('Aucun plat reconnu sur cette image.');
    if (l.remplacer) {
      // Anciennes suggestions retirées (avec leurs accords et leurs consignes).
      await q(`delete from regle_sommelier where restaurant_id = $1 and portee = 'plat'
                 and cible in (select id from plat where restaurant_id = $1 and categorie = 'suggestion')`, [l.restaurant_id]);
      await q(`delete from plat where restaurant_id = $1 and categorie = 'suggestion'`, [l.restaurant_id]);
    }
    const ids: string[] = [];
    for (const p of plats) {
      const base = `${l.restaurant_id}-sugg-${slug(p.nom) || 'plat'}`;
      let id = base;
      for (let n = 2; (await q('select 1 from plat where id = $1', [id])).length; n++) id = `${base}-${n}`;
      await q(
        `insert into plat (id, restaurant_id, nom, categorie, description_cuisine, prix, prix_variantes, ordre, actif, modifie_bo)
         values ($1, $2, $3, 'suggestion', $4, $5, $6, (select coalesce(max(ordre), 0) + 1 from plat where restaurant_id = $2), true, now())`,
        [id, l.restaurant_id, p.nom, p.description, p.prix ?? null, p.prixVariantes ?? null]);
      ids.push(id);
    }
    await q(`update lecture_suggestions set statut = 'ok', maj_le = now(), message = $2 where id = $1`,
      [l.id, `${ids.length} suggestion${ids.length > 1 ? 's' : ''} ajoutée${ids.length > 1 ? 's' : ''} : ${plats.map((p) => p.nom).join(', ')}.`]);
    await q('delete from lecture_suggestions_fichier where lecture_id = $1', [l.id]); // les photos ne sont plus utiles
    return { restaurantId: l.restaurant_id, platIds: ids, demandePar: l.demande_par ?? 'suggestions' };
  } catch (e) {
    console.error('[suggestions]', l.id, e);
    const message = e instanceof Error && (e.name === 'MauvaisDocument' || /illisible|Aucun plat/.test(e.message))
      ? e.message : 'Pat n’a pas réussi à lire cette image. Essayez une photo plus nette, bien droite.';
    await q(`update lecture_suggestions set statut = 'erreur', maj_le = now(), message = $2 where id = $1`, [l.id, message]);
    return { restaurantId: l.restaurant_id, platIds: [], demandePar: '' };
  }
}

/**
 * Traite les lectures en attente jusqu'à l'heure limite ; pour chaque lecture réussie, la préparation des accords
 * des nouvelles suggestions est mise en file (`lancer` : démarre les travailleurs). Renvoie le nombre de lectures restantes.
 */
export async function traiterSuggestions(q: Requete, { finAvant, lancer }: { finAvant: number; lancer: (taches: number) => Promise<void> }) {
  while (Date.now() < finAvant - 2 * 60 * 1000) {
    const r = await lireUne(q);
    if (!r) break;
    if (r.platIds.length) {
      const { crees } = await creerLot(q, r.restaurantId, r.platIds, r.demandePar, { modele: modeleRapide() });
      if (crees) await lancer(crees);
    }
  }
  const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from lecture_suggestions where statut = 'a_lire'`);
  return n;
}
