import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { lireRequete, requeteTexte } from '../src/lib/etiquettes/wine-labs';

// Exemple de la documentation Wine Labs (webhook « wine_label.fulfilled »).
const livraison = {
  id: '076142f5-6ecb-4fa6-a3e4-1689283eb8f9', event: 'wine_label.fulfilled', created_at: '2026-09-15T21:10:32Z', attempt: 1,
  data: { request: {
    id: 'e40a2be1-07c4-4cc6-98ad-44a44a841d48', client_request_id: 'sku-12345', status: 'fulfilled', wine_name: 'Opus One', vintage: '2019',
    label_type: 'bottle', asset_url: 'https://cdn.wine-labs.example/winelabs/cleaned-labels/hash/bf3f78c66e58.png', charged: true, error_details: null,
  } },
};

test('le webhook de Wine Labs est lu (data.request)', () => {
  assert.deepEqual(lireRequete(livraison), {
    id: 'e40a2be1-07c4-4cc6-98ad-44a44a841d48', statut: 'fulfilled',
    image: 'https://cdn.wine-labs.example/winelabs/cleaned-labels/hash/bf3f78c66e58.png', vinId: 'sku-12345',
  });
});

test('la réponse de POST /wine_labels est lue (request)', () => {
  assert.deepEqual(lireRequete({ request: { id: 'abc', status: 'processing', client_request_id: 'L-B12' }, credits: {} }),
    { id: 'abc', statut: 'processing', image: null, vinId: 'L-B12' });
});

test('texte envoyé : producteur ajouté seulement s’il manque', () => {
  assert.equal(requeteTexte({ libelle: 'Meursault Les Tessons', producteur: 'Domaine Pierre Morey' }), 'Domaine Pierre Morey Meursault Les Tessons');
  assert.equal(requeteTexte({ libelle: 'Champagne Ruinart Blanc de Blancs', producteur: 'Ruinart' }), 'Champagne Ruinart Blanc de Blancs');
  assert.equal(requeteTexte({ libelle: 'Bolgheri Sassicaia', producteur: null }), 'Bolgheri Sassicaia');
});

test('signature X-WineLabs-Signature (HMAC-SHA256 hex de « t.corps ») acceptée, falsifiée refusée', async () => {
  // src/lib/wine-labs.ts est « server-only » : le module est chargé sans cette garde.
  const { verifierSignature } = await import('../src/lib/wine-labs-signature');
  const secret = 'whsec_test123';
  const corps = JSON.stringify(livraison);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex');
  const entetes = new Headers({ 'X-WineLabs-Signature': `t=${t},v1=${v1}`, 'X-WineLabs-Delivery-Id': 'd1', 'X-WineLabs-Timestamp': String(t) });
  assert.equal(verifierSignature(corps, entetes, secret).ok, true);
  assert.equal(verifierSignature(corps.replace('Opus', 'Opux'), entetes, secret).ok, false);
  const vieux = new Headers({ 'X-WineLabs-Signature': `t=${t - 600},v1=${createHmac('sha256', secret).update(`${t - 600}.${corps}`).digest('hex')}` });
  assert.equal(verifierSignature(corps, vieux, secret).ok, false);
});

test('une « clé » au format UUID est envoyée comme user_id', async () => {
  const { identifiantsWineLabs } = await import('../src/lib/etiquettes/wine-labs');
  const avant = { ...process.env };
  try {
    process.env.WINE_LABS_API_KEY = '00000000-1111-2222-3333-444444444444'; delete process.env.WINE_LABS_USER_ID;
    assert.deepEqual(identifiantsWineLabs(), { cle: null, userId: '00000000-1111-2222-3333-444444444444' });
    process.env.WINE_LABS_API_KEY = 'wl_live_abc';
    assert.deepEqual(identifiantsWineLabs(), { cle: 'wl_live_abc', userId: null });
    process.env.WINE_LABS_USER_ID = '00000000-1111-2222-3333-444444444444';
    assert.deepEqual(identifiantsWineLabs(), { cle: 'wl_live_abc', userId: '00000000-1111-2222-3333-444444444444' });
  } finally {
    process.env = avant;
  }
});

test('signature Wine Labs avec espaces après la virgule et hex en majuscules', async () => {
  const { verifierSignature } = await import('../src/lib/wine-labs-signature');
  const secret = 'whsec_abc', corps = '{"event":"wine_label.test"}', t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex').toUpperCase();
  assert.equal(verifierSignature(corps, new Headers({ 'X-WineLabs-Signature': `t=${t}, v1=${v1}` }), secret).ok, true);
  assert.equal(verifierSignature(corps, new Headers({ 'X-WineLabs-Signature': `t=${t}, v1=${v1}` }), 'whsec_autre').ok, false);
});
