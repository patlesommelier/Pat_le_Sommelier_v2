import 'server-only';
// Frigos connectés WineMS : bouteilles en consignation (LVQNEP), détectées par leur tag NFC. Quid Vinum relit régulièrement
// l'accès réservé de WineMS (WINEMS_API_URL + WINEMS_API_KEY) et garde, pour chaque restaurant relié à son client WineMS,
// l'état de ses frigos et les bouteilles présentes. Sans configuration, rien ne se passe.
import { requete } from '../db';
import { randomUUID } from 'node:crypto';
import { lireFrigosWineMS, nomCommun, type ClientWineMS } from './winems-donnees';
import { ajouterVinCommande } from '../admin/distributeur-vin';

export const winemsConfigure = () => Boolean(process.env.WINEMS_API_URL?.trim() && process.env.WINEMS_API_KEY?.trim());

/** Relit WineMS et met à jour les frigos et leurs bouteilles ; renvoie le nombre de frigos mis à jour. */
export async function synchroniserFrigos(): Promise<number> {
  if (!winemsConfigure()) return 0;
  const clients: ClientWineMS[] = await lireFrigosWineMS(process.env.WINEMS_API_URL!.trim(), process.env.WINEMS_API_KEY!.trim());
  const relies = await requete<{ id: string; winems_client_id: string }>('select id, winems_client_id from restaurant where winems_client_id is not null');
  let n = 0;
  for (const r of relies) {
    const client = clients.find((c) => String(c.id) === r.winems_client_id.trim());
    if (!client) continue;
    const vus: string[] = [];
    for (const f of client.frigos) {
      const id = String(f.id);
      vus.push(id);
      await requete(
        `insert into frigo (id, restaurant_id, nom, emplacement, capacite, statut, statut_depuis, temperature, temperature_le, cycle, synchro_le)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         on conflict (id) do update set restaurant_id = excluded.restaurant_id, nom = excluded.nom, emplacement = excluded.emplacement,
           capacite = excluded.capacite, statut = excluded.statut, statut_depuis = excluded.statut_depuis, temperature = excluded.temperature,
           temperature_le = excluded.temperature_le, cycle = excluded.cycle, synchro_le = now()`,
        [id, r.id, f.nom, f.emplacement, f.capacite, f.statut, f.statutDepuis, f.temperature, f.temperatureLe, f.cycle ?? null]);
      // Bouteilles présentes : remplacées par celles que WineMS voit maintenant dans ce frigo.
      const tags = f.bouteilles.map((b) => String(b.id));
      await requete('delete from frigo_bouteille where frigo_id = $1 and not (id = any($2))', [id, tags]);
      for (const b of f.bouteilles) {
        await requete(
          `insert into frigo_bouteille (id, frigo_id, restaurant_id, emplacement, entree_le, millesime, winems_vin_id, nom, producteur, appellation,
             couleur, cepages, pays, prix_achat, prix_conseille, image_url)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           on conflict (id) do update set frigo_id = excluded.frigo_id, restaurant_id = excluded.restaurant_id, emplacement = excluded.emplacement,
             entree_le = excluded.entree_le, millesime = excluded.millesime, winems_vin_id = excluded.winems_vin_id, nom = excluded.nom,
             producteur = excluded.producteur, appellation = excluded.appellation, couleur = excluded.couleur, cepages = excluded.cepages,
             pays = excluded.pays, prix_achat = excluded.prix_achat, prix_conseille = excluded.prix_conseille, image_url = excluded.image_url`,
          [String(b.id), id, r.id, b.emplacement, b.entreeLe, b.millesime, b.vin ? String(b.vin.id) : null, b.vin?.nom ?? 'Vin inconnu',
            b.vin?.producteur ?? null, b.vin?.appellation ?? null, b.vin?.couleur ?? null, b.vin?.cepages ?? null, b.vin?.pays ?? null,
            b.prixClient, b.prixFinal, b.vin?.image && /^https:\/\//i.test(b.vin.image) ? b.vin.image : null]);
      }
      n++;
    }
    // Frigos qui ne sont plus chez ce client (retirés, réaffectés) : effacés, avec leurs bouteilles.
    await requete('delete from frigo where restaurant_id = $1 and not (id = any($2))', [r.id, vus]);
    await vinsDuFrigoDansLaCave(r.id).catch((e) => console.error('[frigos] cave', r.id, (e as Error).message));
  }
  return n;
}

/**
 * Les vins du frigo, vins comme les autres : chaque bouteille est rattachée à sa ligne du catalogue LVQNEP (par le vin WineMS
 * déjà lié, sinon par le nom, et le lien est alors gardé) ; chaque vin du frigo a sa ligne dans la cave du restaurant
 * (distributeur LVQNEP, prix convenus), marquée « frigo », dont le stock est le nombre de bouteilles présentes.
 */
export async function vinsDuFrigoDansLaCave(resto: string) {
  const [d] = await requete<{ id: string; nom: string }>(`select id, nom from distributeur where lower(nom) like '%lvqnep%' order by cree_le limit 1`);
  if (!d) return;
  const catalogue = await requete<{ id: string; libelle: string; winems_vin_id: string | null; producteur_texte: string | null }>(
    'select id, libelle, winems_vin_id, producteur_texte from distributeur_vin where distributeur_id = $1 and actif', [d.id]);
  const bouteilles = await requete<{ id: string; winems_vin_id: string | null; nom: string; producteur: string | null }>(
    'select id, winems_vin_id, nom, producteur from frigo_bouteille where restaurant_id = $1', [resto]);
  for (const b of bouteilles) {
    let ligne = b.winems_vin_id ? catalogue.find((c) => c.winems_vin_id === b.winems_vin_id) : undefined;
    if (!ligne) {
      // Première fois : par le nom (sans accents ni lettres doublées), sur une ligne pas encore liée ; le lien est gardé.
      ligne = catalogue.find((c) => !c.winems_vin_id && nomCommun(c.libelle) === nomCommun(b.nom));
      if (ligne && b.winems_vin_id) {
        await requete(`update distributeur_vin set winems_vin_id = $2, producteur_texte = coalesce(nullif(producteur_texte, ''), $3)
                        where id = $1 and winems_vin_id is null`, [ligne.id, b.winems_vin_id, b.producteur]);
        ligne.winems_vin_id = b.winems_vin_id;
      }
    }
    await requete('update frigo_bouteille set distributeur_vin_id = $2 where id = $1', [b.id, ligne?.id ?? null]);
  }
  // Le distributeur LVQNEP chez ce restaurant, puis une ligne de cave par vin du frigo.
  await requete(`insert into fournisseur (id, restaurant_id, nom, distributeur_id) select $1, $2, $3, $4
                  where not exists (select 1 from fournisseur where restaurant_id = $2 and distributeur_id = $4)`, [randomUUID(), resto, d.nom, d.id]);
  const [f] = await requete<{ id: string }>('select id from fournisseur where restaurant_id = $1 and distributeur_id = $2', [resto, d.id]);
  const presents = await requete<{ distributeur_vin_id: string; bouteilles: number }>(
    `select distributeur_vin_id, count(*)::int as bouteilles from frigo_bouteille where restaurant_id = $1 and distributeur_vin_id is not null group by 1`, [resto]);
  for (const p of presents) {
    const [deja] = await requete<{ id: string }>('select id from vin_carte where restaurant_id = $1 and distributeur_vin_id = $2 limit 1', [resto, p.distributeur_vin_id]);
    if (deja) { await requete('update vin_carte set frigo = true where id = $1', [deja.id]); continue; }
    const [prix] = await requete<{ prix: number | null; prix_vente: number | null }>(
      'select prix::float8 as prix, prix_vente::float8 as prix_vente from distributeur_vin_prix_restaurant where distributeur_vin_id = $1 and restaurant_id = $2', [p.distributeur_vin_id, resto]);
    const id = await ajouterVinCommande(resto, p.distributeur_vin_id, f?.id ?? null, prix?.prix ?? null, 0);
    if (!id) continue;
    // Prix de vente de départ (celui convenu dans WineMS), appellation de la ligne LVQNEP si la fiche n'en a pas.
    // Le nom de la cuvée (« Castello di Brolio ») à côté de l'appellation (« Chianti Gran Selezione ») quand ils diffèrent.
    await requete(`update vin_carte v set frigo = true, prix = coalesce(v.prix, $2),
                     appellation_texte = coalesce(v.appellation_texte, dv.appellation),
                     nom_vin = coalesce(v.nom_vin, case when dv.appellation is not null and lower(dv.libelle) <> lower(dv.appellation) then dv.libelle end)
                    from distributeur_vin dv where v.id = $1 and dv.id = v.distributeur_vin_id`, [id, prix?.prix_vente ?? null]);
  }
  // Stock des vins du frigo : les bouteilles présentes ; proposés sur la carte tant qu'il en reste.
  await requete(`update vin_carte v set stock = coalesce(x.n, 0), disponible = coalesce(x.n, 0) > 0
                   from (select v2.id, (select count(*)::int from frigo_bouteille b where b.restaurant_id = v2.restaurant_id and b.distributeur_vin_id = v2.distributeur_vin_id) as n
                           from vin_carte v2 where v2.restaurant_id = $1 and v2.frigo) x
                  where v.id = x.id and (v.stock is distinct from coalesce(x.n, 0) or v.disponible is distinct from (coalesce(x.n, 0) > 0))`, [resto]);
}

export interface FrigoRestaurant {
  id: string; nom: string; emplacement: string | null; capacite: number | null; statut: number | null; statut_depuis: string | null; cycle: number | null;
  temperature: number | null; temperature_le: string | null; synchro_le: string;
  vins: { nom: string; producteur: string | null; appellation: string | null; couleur: string | null; millesime: number | null;
    bouteilles: number; prix_achat: number | null; prix_conseille: number | null; image_url: string | null }[];
}

/** Frigos d'un restaurant et leurs vins présents (une ligne par vin et millésime, avec le nombre de bouteilles). */
export async function getFrigos(resto: string): Promise<FrigoRestaurant[]> {
  const frigos = await requete<Omit<FrigoRestaurant, 'vins'>>(
    `select id, nom, emplacement, capacite, statut, statut_depuis::text, cycle, temperature::float8 as temperature, temperature_le::text, synchro_le::text
       from frigo where restaurant_id = $1 order by nom`, [resto]);
  if (!frigos.length) return [];
  const vins = await requete<FrigoRestaurant['vins'][number] & { frigo_id: string }>(
    // Nom, photo et prix viennent de la base QV (vin LVQNEP relié, prix propres au restaurant) ; à défaut, de WineMS.
    `select fb.frigo_id, coalesce(dv.libelle, fb.nom) as nom, coalesce(fb.producteur, dv.producteur_texte) as producteur,
            coalesce(dv.appellation, fb.appellation) as appellation, coalesce(dv.couleur, fb.couleur) as couleur,
            coalesce(fb.millesime, case when dv.millesime ~ '^\d{4}$' then dv.millesime::int end) as millesime, count(*)::int as bouteilles,
            max(coalesce(px.prix, fb.prix_achat))::float8 as prix_achat, max(coalesce(px.prix_vente, fb.prix_conseille))::float8 as prix_conseille,
            max(coalesce(dv.etiquette_url, c.etiquette_url, fb.image_url)) as image_url
       from frigo_bouteille fb
       left join distributeur_vin dv on dv.id = fb.distributeur_vin_id
       left join cuvee c on c.id = dv.cuvee_id
       left join distributeur_vin_prix_restaurant px on px.distributeur_vin_id = dv.id and px.restaurant_id = fb.restaurant_id
      where fb.restaurant_id = $1
      group by fb.frigo_id, 2, 3, 4, 5, 6 order by 2, 6`, [resto]);
  return frigos.map((f) => ({ ...f, vins: vins.filter((v) => v.frigo_id === f.id).map(({ frigo_id: _f, ...v }) => v) }));
}
