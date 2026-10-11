import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contenanceDuFormat, contenancesDesLignes, ordonner } from '../src/lib/contenances';

test('contenance lue sur la carte', () => {
  assert.equal(contenanceDuFormat('75 cl'), 'bouteille');
  assert.equal(contenanceDuFormat(null), 'bouteille');
  assert.equal(contenanceDuFormat('37,5 cl'), 'demi');
  assert.equal(contenanceDuFormat('18,7 cl'), 'quart');
  assert.equal(contenanceDuFormat('150 cl'), 'magnum');
  assert.equal(contenanceDuFormat('au verre'), 'verre');
});

test('contenances d’un vin : union de ses lignes, bouteille par défaut', () => {
  assert.deepEqual(contenancesDesLignes([{ format: '37,5 cl' }, { format: '75 cl', prixVerre: 12 }]), ['bouteille', 'demi', 'verre']);
  assert.deepEqual(contenancesDesLignes([{ format: null }]), ['bouteille']);
  assert.deepEqual(ordonner([]), ['bouteille']);
  assert.deepEqual(ordonner(['verre', 'inconnu']), ['verre']);
});

test('deux vins lus sous le même nom, même contenance : jamais fusionnés', async () => {
  const { grouperMemeVin } = await import('../src/lib/contenances');
  const l = (id: string, format: string) => ({ id, couleur: 'bulles', libelle: 'Taittinger', millesime: null, format });
  const g = grouperMemeVin([l('E01', '75 cl'), l('E02', '75 cl'), l('E03', '37,5 cl')], (x) => x.format);
  assert.deepEqual(g.map((x) => x.map((y) => y.id)), [['E01', 'E03'], ['E02']]);
});
