import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deposerObjet, type ConfigStockage } from '../src/lib/stockage';

const c: ConfigStockage = { endpoint: 'https://fsn1.example.com', region: 'fsn1', bucket: 'b', cle: 'k', secret: 's', urlPublique: 'https://b.fsn1.example.com' };
const indispo = () => new Response('<Error><Code>ServiceUnavailable</Code><Message>Service is unable to handle request.</Message></Error>', { status: 503 });

function avecFetch(reponses: (() => Response)[]) {
  const origine = globalThis.fetch;
  let appels = 0;
  globalThis.fetch = (async () => reponses[Math.min(appels++, reponses.length - 1)]()) as typeof fetch;
  return { appels: () => appels, fin: () => { globalThis.fetch = origine; } };
}

test('stockage indisponible un instant (503) : le dépôt réessaie et réussit', { timeout: 20_000 }, async () => {
  const f = avecFetch([indispo, () => new Response('', { status: 200 })]);
  try {
    assert.equal(await deposerObjet('base/x.jpg', Buffer.from('img'), 'image/jpeg', c), 'https://b.fsn1.example.com/base/x.jpg');
    assert.equal(f.appels(), 2);
  } finally { f.fin(); }
});

test('stockage toujours indisponible : message clair après 4 essais ; un refus (403) ne réessaie pas', { timeout: 20_000 }, async () => {
  let f = avecFetch([indispo]);
  try {
    await assert.rejects(deposerObjet('base/x.jpg', Buffer.from('img'), 'image/jpeg', c), /momentanément indisponible \(503 : Service is unable/);
    assert.equal(f.appels(), 4);
  } finally { f.fin(); }
  f = avecFetch([() => new Response('<Error><Message>Access Denied</Message></Error>', { status: 403 })]);
  try {
    await assert.rejects(deposerObjet('base/x.jpg', Buffer.from('img'), 'image/jpeg', c), /refusé par le stockage \(403 : Access Denied\)/);
    assert.equal(f.appels(), 1);
  } finally { f.fin(); }
});
