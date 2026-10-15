import 'server-only';
// La base de Pat se complète avec ce que le restaurant écrit dans la fiche d'un vin (ajout ou modification).
// - Vin relié à une cuvée : la cuvée reçoit la couleur, l'appellation et les cépages qui lui manquaient.
//   Ce que la base sait déjà n'est jamais remplacé (les fiches de Pat gardent la main).
// - Vin d'un producteur connu sans cuvée : une cuvée est créée, proposée à Pat (à valider dans « Vins de la base »).
// - Vin sans producteur : il reste trouvable par son intitulé dans les cartes (recherche à l'ajout d'un vin).
import { requete } from '@/lib/db';

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export async function completerBase(vinIds: string[]) {
  if (!vinIds.length) return;
  const vins = await requete<{ id: string; libelle: string; producteur_id: string | null; cuvee_id: string | null }>(
    'select id, libelle, producteur_id, cuvee_id from vin_carte where id = any($1)', [vinIds]);
  for (const v of vins) {
    if (v.cuvee_id || !v.producteur_id) continue;
    // Même identifiant que les cuvées créées au partage des étiquettes : un vin ne crée jamais deux cuvées.
    const id = `carte-${v.producteur_id}-${slug(v.libelle)}`.slice(0, 120);
    await requete(
      `insert into cuvee (id, producteur_id, nom, statut, source) values ($1, $2, $3, 'propose', 'carte') on conflict (id) do nothing`,
      [id, v.producteur_id, v.libelle]);
    await requete('update vin_carte set cuvee_id = $2 where id = $1 and cuvee_id is null', [v.id, id]);
  }
  // Champs manquants de la cuvée, pris dans la fiche du vin (la plus complète des lignes du même vin).
  await requete(
    `update cuvee c set couleur = coalesce(c.couleur, v.couleur),
            appellation_id = coalesce(c.appellation_id, v.appellation_id),
            appellation_texte = coalesce(nullif(c.appellation_texte, ''), v.appellation_texte),
            cepages = coalesce(nullif(c.cepages, ''), v.cepages)
       from (select distinct on (cuvee_id) cuvee_id, couleur, appellation_id, nullif(appellation_texte, '') as appellation_texte,
                    nullif(cepages, '') as cepages
               from vin_carte where id = any($1) and cuvee_id is not null
              order by cuvee_id, (cepages is not null)::int + (appellation_texte is not null)::int + (appellation_id is not null)::int desc) v
      where c.id = v.cuvee_id
        and (c.couleur is null and v.couleur is not null
          or c.appellation_id is null and v.appellation_id is not null
          or coalesce(c.appellation_texte, '') = '' and v.appellation_texte is not null
          or coalesce(c.cepages, '') = '' and v.cepages is not null)`, [vinIds]);
}
