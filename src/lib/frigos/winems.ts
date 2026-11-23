import 'server-only';
// Frigos connectés WineMS : bouteilles en consignation (LVQNEP), détectées par leur tag NFC. Quid Vinum relit régulièrement
// l'accès réservé de WineMS (WINEMS_API_URL + WINEMS_API_KEY) et garde, pour chaque restaurant relié à son client WineMS,
// l'état de ses frigos et les bouteilles présentes. Sans configuration, rien ne se passe.
import { requete } from '../db';
import { lireFrigosWineMS, type ClientWineMS } from './winems-donnees';

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
             couleur, cepages, pays, prix_achat, prix_conseille)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           on conflict (id) do update set frigo_id = excluded.frigo_id, restaurant_id = excluded.restaurant_id, emplacement = excluded.emplacement,
             entree_le = excluded.entree_le, millesime = excluded.millesime, winems_vin_id = excluded.winems_vin_id, nom = excluded.nom,
             producteur = excluded.producteur, appellation = excluded.appellation, couleur = excluded.couleur, cepages = excluded.cepages,
             pays = excluded.pays, prix_achat = excluded.prix_achat, prix_conseille = excluded.prix_conseille`,
          [String(b.id), id, r.id, b.emplacement, b.entreeLe, b.millesime, b.vin ? String(b.vin.id) : null, b.vin?.nom ?? 'Vin inconnu',
            b.vin?.producteur ?? null, b.vin?.appellation ?? null, b.vin?.couleur ?? null, b.vin?.cepages ?? null, b.vin?.pays ?? null,
            b.prixClient, b.prixFinal]);
      }
      n++;
    }
    // Frigos qui ne sont plus chez ce client (retirés, réaffectés) : effacés, avec leurs bouteilles.
    await requete('delete from frigo where restaurant_id = $1 and not (id = any($2))', [r.id, vus]);
  }
  return n;
}

export interface FrigoRestaurant {
  id: string; nom: string; emplacement: string | null; capacite: number | null; statut: number | null; statut_depuis: string | null; cycle: number | null;
  temperature: number | null; temperature_le: string | null; synchro_le: string;
  vins: { nom: string; producteur: string | null; appellation: string | null; couleur: string | null; millesime: number | null;
    bouteilles: number; prix_achat: number | null; prix_conseille: number | null }[];
}

/** Frigos d'un restaurant et leurs vins présents (une ligne par vin et millésime, avec le nombre de bouteilles). */
export async function getFrigos(resto: string): Promise<FrigoRestaurant[]> {
  const frigos = await requete<Omit<FrigoRestaurant, 'vins'>>(
    `select id, nom, emplacement, capacite, statut, statut_depuis::text, cycle, temperature::float8 as temperature, temperature_le::text, synchro_le::text
       from frigo where restaurant_id = $1 order by nom`, [resto]);
  if (!frigos.length) return [];
  const vins = await requete<FrigoRestaurant['vins'][number] & { frigo_id: string }>(
    `select frigo_id, nom, producteur, appellation, couleur, millesime, count(*)::int as bouteilles,
            max(prix_achat)::float8 as prix_achat, max(prix_conseille)::float8 as prix_conseille
       from frigo_bouteille where restaurant_id = $1
      group by frigo_id, nom, producteur, appellation, couleur, millesime order by nom, millesime`, [resto]);
  return frigos.map((f) => ({ ...f, vins: vins.filter((v) => v.frigo_id === f.id).map(({ frigo_id: _f, ...v }) => v) }));
}
