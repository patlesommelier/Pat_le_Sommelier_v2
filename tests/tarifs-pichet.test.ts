import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tarifsDuGroupe } from '../src/lib/contenances';

test('le ¼ en pichet garde son prix, même quand le vin est servi au verre', () => {
  const t = tarifsDuGroupe([
    { format: '75 cl', prix: 29, prix_verre: null },
    { format: '15 cl', prix: 6, prix_verre: null },
    { format: '25 cl', prix: 9.5, prix_verre: null },
    { format: '50 cl', prix: 17, prix_verre: null },
  ]);
  assert.deepEqual(t.map((x) => [x.code, x.prix]), [['bouteille', 29], ['demi', 17], ['quart', 9.5], ['verre', 6]]);
});

test('une vraie demi-bouteille passe avant un pichet de 50 cl', () => {
  const t = tarifsDuGroupe([{ format: '50 cl', prix: 17, prix_verre: null }, { format: '37,5 cl', prix: 21, prix_verre: null }]);
  assert.deepEqual(t.map((x) => [x.code, x.prix]), [['demi', 21]]);
});
