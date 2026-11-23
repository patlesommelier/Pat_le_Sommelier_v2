import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireFrigosWineMS } from '../src/lib/frigos/winems-donnees';

const reponse = (statut: number, corps: unknown) => (async () => new Response(JSON.stringify(corps), { status: statut })) as unknown as typeof fetch;

test('WineMS : frigos lus, erreurs expliquées', async () => {
  const clients = await lireFrigosWineMS('https://api.test/', 'cle', reponse(200, { clients: [{ id: '1', nom: 'Bistro', delaiFacturationMinutes: 60, frigos: [{ id: '10', nom: 'Frigo', bouteilles: undefined }] }] }));
  assert.equal(clients[0].frigos[0].bouteilles.length, 0);
  await assert.rejects(lireFrigosWineMS('https://api.test', 'mauvaise', reponse(401, {})), /refuse la clé/);
  await assert.rejects(lireFrigosWineMS('https://api.test', 'cle', reponse(503, {})), /pas configuré/);
  await assert.rejects(lireFrigosWineMS('https://api.test', 'cle', reponse(200, { autre: 1 })), /illisible/);
});
