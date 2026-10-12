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

test('grouperMemeVin : un même vin au verre sans millésime et en bouteille millésimée, mentions de contenant à part', async () => {
  const { grouperMemeVin } = await import('../src/lib/contenances');
  const l = (libelle: string, millesime: string | null, format: string) => ({ couleur: 'rose', libelle, millesime, format });
  const g = grouperMemeVin([
    l('M de Minuty', null, 'au verre'), l('M de Minuty', '2023', '75 cl'), l('M de Minuty (magnum)', '2023', '150 cl'),
    l('Ostal Cazes rosé', null, 'au verre'), l('Ostal Cazes rosé', '2024', '75 cl'),
    l('Taittinger Demi-Sec', null, '75 cl'), l('Taittinger', null, '75 cl'),
    l('Château X', '2019', '75 cl'), l('Château X', '2020', '37,5 cl'),
  ], (x) => x.format);
  assert.deepEqual(g.map((x) => x.length), [3, 2, 1, 1, 1, 1]);
  assert.equal(g[0][0].format, 'au verre'); // ordre de la carte gardé
});
