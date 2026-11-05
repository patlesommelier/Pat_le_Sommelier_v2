/**
 * Vins lus sur la carte à l'inscription, comparés à la base de Pat : un vin dont le producteur (validé) et la cuvée sont
 * retrouvés est « reconnu » et reprend les données de la base (producteur, nom du vin, appellation ; le millésime reste
 * celui de la carte, la base n'en a pas). Les autres restent tels que lus, « en attente de validation » par Pat.
 * En cas de doute (plusieurs cuvées possibles), le vin n'est pas reconnu.
 * Sans 'server-only' : appelé par la finalisation de l'inscription (fonction d'arrière-plan comprise).
 */
import type { Requete } from '../generation/accords';
import { cuveeDuVin, type CuveeBase } from '../distributeurs/rattachement';
import { motsDe } from '../distributeurs/tarif';
import { composerIntitule } from '../admin/intitule';

/**
 * Cuvée du producteur reconnue dans le nom lu sur la carte : d'abord les mêmes mots (cuveeDuVin) ; sinon une carte qui
 * abrège (« Crémant Zéro Dosage » pour « Crémant d'Alsace Zéro Dosage ») : tous les mots propres à la cuvée (hors appellation)
 * sont sur la carte, et la carte ne dit rien que la cuvée ou son appellation ne dise. Une seule cuvée possible, sinon aucune.
 */
export function cuveeReconnue<C extends CuveeBase>(v: { libelle: string; producteur_texte: string | null }, cuvees: C[], producteurNom: string | null): C | null {
  const exacte = cuveeDuVin(v, cuvees, producteurNom) as C | null;
  if (exacte) return exacte;
  const retirer = new Set([...motsDe(v.producteur_texte), ...motsDe(producteurNom)]);
  const mots = (t: string | null) => motsDe(t).filter((m) => !retirer.has(m));
  const vin = mots(v.libelle);
  if (!vin.length) return null;
  const trouvees = cuvees.filter((c) => {
    const appellation = mots(c.appellation);
    const propres = mots(c.nom).filter((m) => !appellation.includes(m));
    const connus = new Set([...mots(c.nom), ...appellation]);
    if (!vin.every((m) => connus.has(m))) return false; // la carte dit autre chose
    // Mots propres à la cuvée tous présents ; une cuvée qui ne porte que l'appellation : l'appellation entière.
    return propres.length ? propres.every((m) => vin.includes(m)) : appellation.length > 0 && appellation.every((m) => vin.includes(m));
  });
  return trouvees.length === 1 ? trouvees[0] : null;
}

export async function reconnaitreVins(requete: Requete, restaurantId: string): Promise<number> {
  const vins = await requete<{ id: string; libelle: string; producteur_texte: string | null; producteur_id: string; producteur_nom: string; cepages: string | null }>(
    `select v.id, v.libelle, v.producteur_texte, v.producteur_id, p.nom as producteur_nom, v.cepages
       from vin_carte v join producteur p on p.id = v.producteur_id and p.statut = 'valide'
      where v.restaurant_id = $1 and v.cuvee_id is null and v.lu_sur_carte is not null`, [restaurantId]);
  if (!vins.length) return 0;
  const cuvees = await requete<CuveeBase & { appellation_id: string | null; cepages: string | null }>(
    `select c.id, c.producteur_id, c.nom, t.nom as appellation, c.appellation_id, c.cepages
       from cuvee c left join terroir t on t.id = c.appellation_id
      where c.producteur_id = any($1) and c.statut <> 'retire'`, [[...new Set(vins.map((v) => v.producteur_id))]]);
  let reconnus = 0;
  for (const v of vins) {
    const c = cuveeReconnue(v, cuvees.filter((x) => x.producteur_id === v.producteur_id), v.producteur_nom);
    if (!c) continue;
    const libelle = composerIntitule({ appellation: c.appellation, nom: c.nom, cepage: v.cepages || c.cepages, producteur: v.producteur_nom }) || v.libelle;
    await requete(
      `update vin_carte set cuvee_id = $2, producteur_texte = $3, nom_vin = $4, appellation_id = coalesce($5, appellation_id),
              appellation_texte = coalesce($6, appellation_texte), libelle = $7
        where id = $1 and cuvee_id is null`,
      [v.id, c.id, v.producteur_nom, c.nom, c.appellation_id, c.appellation, libelle]);
    reconnus++;
  }
  return reconnus;
}
