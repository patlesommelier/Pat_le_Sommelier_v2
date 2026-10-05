// Publication des principes et des règles, validation d'un producteur : tests sur une base Postgres de test.
// Ils écrivent dans la base : ne les lancer que sur une copie locale (TEST_DATABASE_URL), jamais sur la production.
// Sans TEST_DATABASE_URL, ils sont ignorés. Claude est remplacé par un faux client (réponses déterministes).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import type Anthropic from '@anthropic-ai/sdk';
import { lireExcel } from '../src/lib/principes/format';
import { importerVersion, installerEnService, modifierPrincipeBrouillon, versionEnService } from '../src/lib/principes/versions';
import { enregistrerBrouillonRegles, installerReglesEnService, reglesEnService } from '../src/lib/regles/versions';
import { annulerPublication, confirmerPublication, etatPublication, preparerPublication, travaillerPublications } from '../src/lib/publication/publication';
import { validerProducteur } from '../src/lib/producteurs/validation';
import { REGLAGES_PAT } from '../src/lib/selection';

const url = process.env.TEST_DATABASE_URL;
const ignorer = !url && 'TEST_DATABASE_URL absente (base de test locale)';
let pool: pg.Pool;
const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];

// Faux Claude : une note et un commentaire positif, propres à chaque vin, pour chaque ligne « CODE | libellé ».
const prompts: string[] = [];
const fauxClaude = {
  messages: {
    stream: (corps: { system?: { text: string }[]; messages: { content: string }[] }) => ({
      finalMessage: async () => {
        const texte = corps.messages[0].content;
        prompts.push(`${corps.system?.map((s) => s.text).join('') ?? ''}\n${texte}`);
        const lignes = texte.split('\n').filter((l) => /^[A-Z]-[A-Z]\d{2} \|/.test(l));
        const angles = ['texture', 'fraîcheur', 'finale', 'bouche', 'structure', 'parfum', 'élan', 'salinité'];
        const out = lignes.map((l, i) => {
          const [code, libelle] = l.split(' | ');
          const imposee = l.match(/note imposée : (\d)/)?.[1];
          const h = [...code].reduce((a, c) => a + c.charCodeAt(0), 0);
          return { vin: code, note: imposee ? Number(imposee) : 1 + (h % 5),
            commentaire: `${['Avec ce plat', 'Sur la chair', 'En bouche', 'À table', 'Côté texture', 'Dès la gorgée'][i % 6]}, le ${libelle} apporte une ${angles[(h + i) % 8]} vive au cépage pinot ${code}.`,
            limite: 'interne' };
        });
        return { content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } };
      },
    }),
  },
} as unknown as Anthropic;

before(async () => {
  if (ignorer) return;
  pool = new pg.Pool({ connectionString: url });
  // Point de départ : V5 en service, V6 en brouillon, règles V7 en service.
  await q(`delete from publication`);
  await q(`delete from principes_version`);
  await q(`delete from regles_version`);
  await installerEnService(q, 'V5', await lireExcel(fs.readFileSync('data/pat/principes_pat_V5.xlsx')), 'test', 'V5');
  await importerVersion(q, { nomFichier: 'principes_pat_V6.xlsx', contenu: fs.readFileSync('data/pat/principes_pat_V6.xlsx'), par: 'test', code: 'V6' });
  await installerReglesEnService(q, 'V7', REGLAGES_PAT, 'test');
});
after(async () => { if (!ignorer) await pool.end(); });

const unPlat = async () => (await q<{ id: string; restaurant_id: string }>(
  `select pl.id, pl.restaurant_id from plat pl where pl.actif and exists (select 1 from accord a where a.plat_id = pl.id) order by pl.ordre limit 1`))[0];
// Préparation limitée à un plat pour aller vite : les autres plats de la publication sont marqués faits sans changement.
async function preparerUnPlat(platId: string) {
  const r = await preparerPublication(q, 'principes', 'test');
  assert.deepEqual(r.erreurs, []);
  await q(`update publication_plat set statut = 'fait', changements = '{"entrent":[],"sortent":[],"notes":[]}' where publication_id = $1 and plat_id <> $2`, [r.publicationId, platId]);
  await travaillerPublications(q, { finAvant: Date.now() + 60_000, client: fauxClaude, modele: 'test' });
  return r.publicationId!;
}

test('publication des principes : préparée sans rien changer chez le client, puis confirmée', { skip: ignorer }, async () => {
  const plat = await unPlat();
  // Le restaurant a corrigé une note et réécrit un commentaire : les deux doivent survivre.
  const [a1, a2] = await q<{ vin_id: string; note: number }>(`select vin_id, note from accord where plat_id = $1 order by vin_id limit 2`, [plat.id]);
  const noteManuelle = a1.note === 5 ? 4 : a1.note + 1;
  await q(`update accord set note = $3, origine = 'sommelier' where plat_id = $1 and vin_id = $2`, [plat.id, a1.vin_id, noteManuelle]);
  await q(`update accord set commentaire_sommelier = 'Texte du restaurant.', explication = 'Texte du restaurant.' where plat_id = $1 and vin_id = $2`, [plat.id, a2.vin_id]);
  const avant = await q<{ vin_id: string; note: number; explication: string }>(`select vin_id, note, explication from accord where plat_id = $1 order by vin_id`, [plat.id]);

  prompts.length = 0;
  const id = await preparerUnPlat(plat.id);
  const e = (await etatPublication(q, id))!;
  assert.equal(e.statut, 'preparee');
  assert.equal(e.erreurs, 0);
  // Seuls les principes actifs sont transmis : n°17 et 31 (archivés en V6) absents ; n°44 seulement si sauce à part.
  assert.ok(prompts.length > 0);
  assert.ok(!/n°17 \[/.test(prompts[0]) && !/n°31 \[/.test(prompts[0]));
  assert.ok(!/n°44 \[/.test(prompts[0]));
  // Rien n'a changé chez le client.
  assert.deepEqual(await q(`select vin_id, note, explication from accord where plat_id = $1 order by vin_id`, [plat.id]), avant);

  assert.deepEqual((await confirmerPublication(q, id, 'test')).erreurs, []);
  assert.equal((await versionEnService(q))?.code, 'V6');
  const apres = new Map((await q<{ vin_id: string; note: number; explication: string; origine: string }>(
    `select vin_id, note, explication, origine::text from accord where plat_id = $1`, [plat.id])).map((x) => [x.vin_id, x]));
  assert.equal(apres.get(a1.vin_id)!.note, noteManuelle, 'la note changée à la main est conservée');
  assert.equal(apres.get(a2.vin_id)!.explication, 'Texte du restaurant.', 'le commentaire réécrit est conservé');
  const retires = await q<{ numero: number }>(`select abs(numero) as numero from principe where statut = 'retire' order by 1`);
  assert.deepEqual(retires.map((r) => r.numero), [17, 31]);
});

test('une préparation dont le brouillon a changé ne peut pas être confirmée', { skip: ignorer }, async () => {
  // Nouveau brouillon (V7 de principes) à partir du fichier V6, préparé, puis modifié.
  await importerVersion(q, { nomFichier: 'principes_pat_V6.xlsx', contenu: fs.readFileSync('data/pat/principes_pat_V6.xlsx'), par: 'test', code: 'V7' });
  const id = await preparerUnPlat((await unPlat()).id);
  await new Promise((r) => setTimeout(r, 20));
  await modifierPrincipeBrouillon(q, 41, { regle: 'Règle modifiée après la préparation.' });
  const r = await confirmerPublication(q, id, 'test');
  assert.match(r.erreurs.join(), /modifié depuis la préparation/);
  assert.equal((await versionEnService(q))?.code, 'V6');
  await annulerPublication(q, id);
});

test('le principe n°44 n’est transmis que pour un plat dont la sauce est servie à part', { skip: ignorer }, async () => {
  const plat = await unPlat();
  await q(`update plat set sauce_servie_a_part = true where id = $1`, [plat.id]);
  prompts.length = 0;
  const id = await preparerUnPlat(plat.id);
  assert.match(prompts[0], /Sauce servie à part, comme condiment : applique le principe n°44/);
  await q(`update plat set sauce_servie_a_part = null where id = $1`, [plat.id]);
  await annulerPublication(q, id);
});

test('publication des règles : immédiate, puis en service', { skip: ignorer }, async () => {
  assert.deepEqual((await enregistrerBrouillonRegles(q, { ...REGLAGES_PAT, premiers: 2, maximum: 4 })).erreurs, []);
  const r = await preparerPublication(q, 'regles', 'test');
  const e = (await etatPublication(q, r.publicationId!))!;
  assert.equal(e.statut, 'preparee');
  assert.ok(e.platsModifies > 0, 'moins de vins proposés : des plats changent');
  assert.deepEqual((await confirmerPublication(q, r.publicationId!, 'test')).erreurs, []);
  assert.equal((await reglesEnService(q))?.parametres.premiers, 2);
  await installerReglesEnService(q, 'V7', REGLAGES_PAT, 'test'); // remise en état
});

test('valider un producteur : ses vins passent « Déjà référencé », le ranking par cuvée est gardé', { skip: ignorer }, async () => {
  const [p] = await q<{ id: string }>(`select p.id from producteur p where p.statut = 'propose'
    and (select count(*) from vin_carte v where v.producteur_id = p.id) >= 1 limit 1`);
  if (!p) return;
  // Deux cas : un vin avec son ranking de cuvée, un autre sans ranking.
  const vins = await q<{ id: string }>(`select id from vin_carte where producteur_id = $1 order by id`, [p.id]);
  await q(`update vin_carte set ranking_producteur = 2 where id = $1`, [vins[0].id]);
  const autre = (await q<{ id: string }>(`select id from vin_carte where producteur_id is null limit 1`))[0];
  await q(`update vin_carte set producteur_id = $2, ranking_producteur = null where id = $1`, [autre.id, p.id]);

  const r = await validerProducteur(q, { producteurId: p.id, rankingProducteur: 4, par: 'test' });
  assert.deepEqual(r.erreurs, []);
  const rk = new Map((await q<{ id: string; ranking_producteur: number; statut: string }>(
    `select v.id, v.ranking_producteur, p.statut::text from vin_carte v join producteur p on p.id = v.producteur_id where p.id = $1`, [p.id]))
    .map((v) => [v.id, v]));
  assert.equal(rk.get(vins[0].id)!.ranking_producteur, 2, 'ranking de la cuvée gardé');
  assert.equal(rk.get(autre.id)!.ranking_producteur, 4, 'vin sans ranking : celui du producteur');
  assert.ok([...rk.values()].every((v) => v.statut === 'valide'));
  // Correction explicite d'une cuvée.
  await validerProducteur(q, { producteurId: p.id, rankingProducteur: 4, vins: [{ vinId: vins[0].id, ranking: 3 }], par: 'test' });
  assert.equal((await q<{ r: number }>(`select ranking_producteur as r from vin_carte where id = $1`, [vins[0].id]))[0].r, 3);
});
