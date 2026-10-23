import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reunirDoublons } from '../src/lib/contenances';

const l = (id: string, libelle: string, producteur: string | null, format: string, prix: number | null, prix_verre: number | null = null) =>
  ({ id, couleur: 'blanc', libelle, producteur, millesime: '2025', format, prix, prix_verre });

test('le même vin écrit deux fois (mots dans un autre ordre) est réuni', () => {
  const a = [l('a1', "IGP Pays D'Oc Le Pré Blanc", 'La petite source', '75 cl', 23.5, 5)];
  const b = [l('b1', "La Petite Source, IGP Pays D'Oc Le Pré Blanc", 'La petite source', '75 cl', 23.5)];
  const c = [l('c1', 'Sancerre Cuvée Vieilles Vignes', 'Roger Neveu', '75 cl', 43)];
  assert.deepEqual(reunirDoublons([a, b, c]).map((g) => g.map((x) => x.id)), [['a1', 'b1'], ['c1']]);
});

test('deux vins lus sous le même nom, à des prix différents, restent séparés', () => {
  const brut = [{ ...l('t1', 'Champagne Taittinger', null, '75 cl', 70), couleur: 'bulles' }];
  const rose = [{ ...l('t2', 'Champagne Taittinger', null, '75 cl', 85), couleur: 'bulles' }];
  assert.equal(reunirDoublons([brut, rose]).length, 2);
});
