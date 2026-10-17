/**
 * Rattrapage des producteurs des vins de carte (au déploiement, avant le partage des étiquettes) :
 * 1. un vin sans producteur retrouve celui de la base : par le nom lu sur la carte, ou par le nom du vin
 *    (« Riesling Eisquell - Weingut Battenfeld Spanier ») ;
 * 2. un vin rattaché à un producteur « à valider » créé à la lecture d'une carte, doublon d'un producteur validé
 *    (« Château Mourgues du Grès - François Collard »), passe sur le producteur validé ; le doublon, sans plus aucun vin,
 *    quitte la liste des producteurs à valider.
 * Les vins passent « Déjà référencé » avec le ranking du producteur ; leurs étiquettes viennent ensuite (partagerEtiquettes).
 *
 * Sans 'server-only' : appelé par scripts/migrer.ts. Idempotent : ne fait rien quand tout est déjà rattaché.
 */
import type { Requete } from '../generation/accords';
import type { Vin } from '../inscription/donnees';
import { producteurConnu, producteursDansLeNom } from '../inscription/lecture';

export async function rattacherProducteurs(requete: Requete) {
  let rattaches = 0;
  const relier = async (ids: string[], producteurId: string) => {
    await requete(
      `update vin_carte v set producteur_id = p.id, ranking_producteur = coalesce(p.ranking_pat, v.ranking_producteur)
         from producteur p where p.id = $2 and v.id = any($1)`, [ids, producteurId]);
    rattaches += ids.length;
  };

  // 1. Vins sans producteur.
  const sans = await requete<{ id: string; libelle: string; producteur_texte: string | null; appellation: string | null; couleur: string }>(
    `select v.id, v.libelle, v.producteur_texte, coalesce(t.nom, v.appellation_texte) as appellation, v.couleur::text
       from vin_carte v left join terroir t on t.id = v.appellation_id where v.producteur_id is null`);
  const parNom = sans.filter((v) => !v.producteur_texte);
  const trouves = parNom.length
    ? await producteursDansLeNom(requete, parNom.map((v) => ({ libelleCarte: v.libelle, producteur: null, appellation: v.appellation, couleur: v.couleur } as Vin)))
    : [];
  for (const v of sans) {
    const nom = v.producteur_texte ?? trouves[parNom.indexOf(v)]?.producteur ?? null;
    if (!nom) continue;
    const p = await producteurConnu(requete, nom, { valideSeulement: true });
    if (p) await relier([v.id], p.id);
  }

  // 2. Producteurs « à valider » qui doublonnent un producteur validé.
  const proposes = await requete<{ id: string; nom: string }>(
    `select p.id, p.nom from producteur p where p.statut = 'propose' and exists (select 1 from vin_carte v where v.producteur_id = p.id)`);
  for (const d of proposes) {
    // Même nom, mot pour mot (lui ou l'un de ses morceaux) : « Château Laroze » n'est pas « Domaine Drouhin-Laroze ».
    const p = await producteurConnu(requete, d.nom, { exclure: d.id, valideSeulement: true, memesMots: true });
    if (!p) continue;
    const vins = (await requete<{ id: string }>('select id from vin_carte where producteur_id = $1', [d.id])).map((v) => v.id);
    await relier(vins, p.id);
    const [{ n }] = await requete<{ n: number }>('select count(*)::int as n from cuvee where producteur_id = $1', [d.id]);
    if (!n) {
      await requete(`update producteur set statut = 'retire', motif_rejet = $2, maj_le = now() where id = $1`,
        [d.id, `Doublon d’un producteur de la base (${p.id}) : ses vins y sont rattachés.`]);
    }
  }
  return rattaches;
}
