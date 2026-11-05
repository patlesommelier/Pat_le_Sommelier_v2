// Accords : la consigne commune est mise en cache par une première demande seule, puis relue par les autres ;
// la réflexion de Claude est réglée (effort « medium » par défaut).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Anthropic from '@anthropic-ai/sdk';
import { regenererAccordsPlat, type Requete } from '../src/lib/generation/accords';

const VINS = Array.from({ length: 60 }, (_, i) => ({ id: `v${i}`, couleur: 'rouge', libelle: `Vin ${i}`, producteur: null, millesime: null, format: null,
  prix: 30, prix_verre: null, cepages: null, profil: null, ranking_producteur: null, avis_pat: null, coup_de_coeur: false, appellation: null, ordre: i }));

const q: Requete = async <T,>(sql: string) => {
  if (/from plat pl left join profil_accord/.test(sql)) return [{ id: 'p1', nom: 'Filet', nom_court: null, categorie: 'plat', description_cuisine: null, ancrages: [], profil: null,
    couleurs_ok: [], cepages_conseilles: [], a_eviter: null, temperature_service: null, principes: [], plafond: null, sauce_servie_a_part: null }] as T[];
  if (/from vin_carte v left join producteur/.test(sql)) return VINS as T[];
  return [] as T[];
};

function fauxClient() {
  const appels: { debut: number; fin: number; effort?: string }[] = [];
  const client = { messages: { stream: (params: { messages: { content: string }[]; output_config?: { effort?: string } }) => ({
    finalMessage: async () => {
      const a = { debut: Date.now(), fin: 0, effort: params.output_config?.effort };
      appels.push(a);
      await new Promise((r) => setTimeout(r, 30));
      a.fin = Date.now();
      const ids = [...params.messages[0].content.matchAll(/^(v\d+) \|/gm)].map((m) => m[1]);
      return { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: 'text', text: JSON.stringify(ids.map((vin) => ({ vin, note: 1, commentaire: '', limite: null }))) }] };
    } }) } };
  return { client: client as unknown as Anthropic, appels };
}

test('accords : premier paquet seul (mise en cache), puis paquets en parallèle ; effort medium', async () => {
  const { client, appels } = fauxClient();
  await regenererAccordsPlat(q, client, 'resto-cache', 'p1', 'modele-test');
  assert.equal(appels.length, 3, '60 vins = 3 paquets');
  assert.ok(appels[1].debut >= appels[0].fin, 'le 2e paquet attend la fin du 1er');
  assert.ok(Math.abs(appels[2].debut - appels[1].debut) < 15, 'les paquets suivants partent ensemble');
  assert.ok(appels.every((a) => a.effort === 'medium'));

  // Plat suivant du même restaurant : consigne déjà en cache, tous les paquets partent ensemble.
  const deux = fauxClient();
  await regenererAccordsPlat(q, deux.client, 'resto-cache', 'p1', 'modele-test');
  assert.ok(Math.abs(deux.appels[2].debut - deux.appels[0].debut) < 15, 'cache chaud : tout en parallèle');
});

test('accords : vins toujours oubliés → corrections par paquets, plus jamais un appel par vin', async () => {
  let appels = 0;
  const client = { messages: { stream: () => ({ finalMessage: async () => {
    appels++;
    return { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: '[]' }] };
  } }) } } as unknown as Anthropic;
  await regenererAccordsPlat(q, client, 'resto-oublis', 'p1', 'modele-test');
  // 60 vins : premier passage 3 paquets, 3 tours de correction (3 paquets), derniers vins 2 essais × 6 paquets de 10.
  assert.equal(appels, 3 + 3 * 3 + 2 * 6);
});

test('accords : seuls les commentaires des vins visibles (les mieux notés) sont corrigés', async () => {
  const demandes: number[] = [];
  const client = { messages: { stream: (params: { messages: { content: string }[] }) => ({ finalMessage: async () => {
    const ids = [...params.messages[0].content.matchAll(/^(v\d+) \|/gm)].map((m) => m[1]);
    demandes.push(ids.length);
    // Tous notés 3, avec un commentaire trop court (défaut de style seulement).
    return { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'text', text: JSON.stringify(ids.map((vin) => ({ vin, note: 3, commentaire: `Bel accord ${vin}.`, limite: null }))) }] };
  } }) } } as unknown as Anthropic;
  await regenererAccordsPlat(q, client, 'resto-visibles', 'p1', 'modele-test');
  // Premier passage (3 paquets), puis un seul tour de correction pour les 8 vins visibles ; rien pour les 52 autres.
  assert.deepEqual(demandes.slice(3), [8]);
});

test('accords : une note hors bornes est ramenée sans redemander à Claude, et les défauts sont comptés', async () => {
  let appels = 0;
  const client = { messages: { stream: (params: { messages: { content: string }[] }) => ({ finalMessage: async () => {
    appels++;
    const ids = [...params.messages[0].content.matchAll(/^(v\d+) \|/gm)].map((m) => m[1]);
    return { stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'text', text: JSON.stringify(ids.map((vin) => ({ vin, note: 1.4, commentaire: '', limite: null }))) }] };
  } }) } } as unknown as Anthropic;
  const b = await regenererAccordsPlat(q, client, 'resto-notes', 'p1', 'modele-test');
  assert.equal(appels, 3); // premier passage seulement
  assert.equal(b.defauts?.['notes ramenées au plafond'], 60);
  assert.equal(b.defauts?.vins, 60);
});
