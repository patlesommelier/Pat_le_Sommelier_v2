import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domaineDuSite, normaliserCepages } from '../src/lib/distributeurs/completer';

test('cépages : sans pourcentages, en minuscules, séparés par des virgules', () => {
  assert.equal(normaliserCepages('Chardonnay 80%, Pinot Noir 20%'), 'chardonnay, pinot noir');
  assert.equal(normaliserCepages('100% Nebbiolo'), 'nebbiolo');
  assert.equal(normaliserCepages('Sangiovese (85 %) e Merlot (15 %)'), 'sangiovese, merlot');
  assert.equal(normaliserCepages('Glera; Verdiso / Perera'), 'glera, verdiso, perera');
  assert.equal(normaliserCepages('Cabernet Sauvignon et Cabernet Franc'), 'cabernet sauvignon, cabernet franc');
  assert.equal(normaliserCepages('Pinot Noir, pinot noir'), 'pinot noir');
  assert.equal(normaliserCepages('Nero d’Avola 70,5%, Frappato 29,5%'), 'nero d’avola, frappato');
  assert.equal(normaliserCepages(''), null);
  assert.equal(normaliserCepages(null), null);
});

test('site du distributeur : son domaine', () => {
  assert.equal(domaineDuSite('www.licata.be'), 'licata.be');
  assert.equal(domaineDuSite('https://www.licata.be/fr/vins'), 'licata.be');
  assert.equal(domaineDuSite(''), null);
  assert.equal(domaineDuSite(null), null);
});
