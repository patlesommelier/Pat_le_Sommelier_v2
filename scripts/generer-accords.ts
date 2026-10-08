/**
 * Calcule les accords mets/vins d'un restaurant avec Claude et les enregistre avec le statut « proposé ».
 * Le sommelier les valide ensuite (statut « valide ») ; seuls les accords validés sont montrés aux clients
 * (sauf AFFICHER_ACCORDS_PROPOSES=true pour une démo).
 *
 *   npm run accords -- --restaurant lola              → tous les plats
 *   npm run accords -- --restaurant lola --plat lola-solettes-meuniere
 *
 * Les accords déjà validés ou refusés ne sont jamais modifiés.
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';
import { consigneAccords, systemePat, type PlatCtx, type PrincipeCtx, type RegleCtx, type VinCtx } from '../src/lib/pat-cerveau';
import { clientClaude } from '../src/lib/claude';

const arg = (nom: string) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const restaurant = arg('restaurant') ?? 'lola';
  const seulPlat = arg('plat');
  if (!process.env.DATABASE_URL || !process.env.ANTHROPIC_API_KEY) throw new Error('DATABASE_URL et ANTHROPIC_API_KEY sont nécessaires');
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: /localhost|host=\/tmp/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  const q = async <T>(sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as T[];

  const principes = await q<PrincipeCtx>(`select id, numero, titre, regle, role, statut from principe where statut <> 'retire'`);
  const regles = await q<RegleCtx>(`select type, portee, cible, valeur, texte from regle_sommelier where restaurant_id = $1 and actif order by priorite`, [restaurant]);
  const carte = await q<VinCtx & { prix: number | null }>(
    `select v.id, v.couleur, v.libelle, coalesce(p.nom, v.producteur_texte) as producteur, v.millesime, v.format,
            v.prix::float as prix, v.prix_verre::float as prix_verre, v.cepages, v.profil_degustation as profil,
            p.ranking_pat as ranking_producteur, p.avis_pat, v.coup_de_coeur
       from vin_carte v left join producteur p on p.id = v.producteur_id
      where v.restaurant_id = $1 and v.disponible order by v.ordre`, [restaurant]);
  const plats = await q<PlatCtx>(
    `select pl.id, pl.nom, pl.categorie, pl.description_cuisine, coalesce(pa.ancrages,'{}') as ancrages, pa.profil, coalesce(pa.couleurs_ok::text[],'{}') as couleurs_ok,
            coalesce(pa.cepages_conseilles,'{}') as cepages_conseilles, pa.a_eviter, pa.temperature_service, coalesce(pa.principes,'{}') as principes, pa.plafond
       from plat pl join profil_accord pa on pa.plat_id = pl.id
      where pl.restaurant_id = $1 and pl.actif ${seulPlat ? 'and pl.id = $2' : ''} order by pl.ordre`,
    seulPlat ? [restaurant, seulPlat] : [restaurant]);

  const nombre = Number(regles.find((r) => r.type === 'nombre_propositions')?.valeur ?? 5);
  const client = clientClaude();
  const systeme = systemePat(restaurant, principes, regles);
  const codes = new Set(carte.map((v) => v.id));

  for (const plat of plats) {
    // Pré-filtre : couleurs compatibles avec le profil du plat (toutes si le profil n'en indique pas).
    const candidats = plat.couleurs_ok.length ? carte.filter((v) => plat.couleurs_ok.includes(v.couleur)) : carte;
    const r = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: systeme,
      messages: [{ role: 'user', content: consigneAccords(plat, candidats.length ? candidats : carte, nombre + 1) }],
    });
    const texte = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    let accords: { vin: string; note: number; explication: string; explication_longue?: string; principes?: string[]; service?: string }[] = [];
    try {
      accords = JSON.parse(texte.slice(texte.indexOf('['), texte.lastIndexOf(']') + 1));
    } catch {
      console.warn(`✗ ${plat.nom} : réponse illisible, plat ignoré`);
      continue;
    }
    const valides = accords.filter((a) => codes.has(a.vin)).slice(0, nombre + 1);
    for (const [i, a] of valides.entries()) {
      const note = Math.max(1, Math.min(plat.plafond ?? 5, Math.round(a.note)));
      await db.query(
        `insert into accord (restaurant_id, plat_id, vin_id, note, rang, explication, explication_longue, principes, service, origine, statut)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pat','propose')
         on conflict (plat_id, vin_id) do update set note = excluded.note, rang = excluded.rang, explication = excluded.explication,
           explication_longue = excluded.explication_longue, principes = excluded.principes, service = excluded.service, calcule_le = now()
         where accord.statut = 'propose'`,
        [restaurant, plat.id, a.vin, note, i + 1, a.explication, a.explication_longue ?? null, a.principes ?? [], a.service ?? plat.temperature_service],
      );
    }
    console.log(`✓ ${plat.nom} : ${valides.map((a) => `${a.vin} (${a.note}/5)`).join(', ')}`);
  }
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
