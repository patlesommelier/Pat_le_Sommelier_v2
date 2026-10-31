import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireApiTarif } from '../src/lib/distributeurs/lecture';

test('API du distributeur : JSON lu sans IA, clé envoyée dans l’en-tête choisi', async () => {
  const avant = globalThis.fetch;
  let entetes: Record<string, string> = {};
  globalThis.fetch = (async (_: unknown, init?: RequestInit) => {
    entetes = init?.headers as Record<string, string>;
    return new Response(JSON.stringify({ produits: [{ domaine: 'Domaine Huet', libelle: 'Vouvray Le Mont sec', millesime: '2023', prix_htva: '24,50', stock: 'disponible' }] }),
      { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const lu = await lireApiTarif('https://api.exemple.be/tarif', 'X-API-Key', 'cle', 'sonnet');
    assert.equal(entetes['X-API-Key'], 'cle');
    assert.equal(lu.methode, 'colonnes reconnues, sans IA');
    assert.deepEqual(lu.vins.map((v) => [v.producteur, v.libelle, v.millesime, v.prix, v.epuise]), [['Domaine Huet', 'Vouvray Le Mont sec', '2023', 24.5, false]]);
    await assert.rejects(lireApiTarif('http://api.exemple.be', null, null, 'sonnet'), /https/);
  } finally {
    globalThis.fetch = avant;
  }
});
