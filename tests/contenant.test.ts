import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sansContenance } from '../src/lib/format';

test('présentation sans mention du contenant', () => {
  const t = 'Ruinart, la plus ancienne maison de Champagne, signe ici son brut emblématique. Le pinot noir apporte le fruit, le chardonnay la fraîcheur. La demi-bouteille garde tout l’élan de la cuvée : l’idéal à deux. Parfait avec des huîtres.';
  assert.equal(sansContenance(t), 'Ruinart, la plus ancienne maison de Champagne, signe ici son brut emblématique. Le pinot noir apporte le fruit, le chardonnay la fraîcheur. Parfait avec des huîtres.');
  assert.equal(sansContenance('Un vin servi au verre.'), 'Un vin servi au verre.'); // presque rien ne resterait : gardé
  assert.equal(sansContenance('Un rouge souple et fruité, à boire frais.'), 'Un rouge souple et fruité, à boire frais.');
  assert.equal(sansContenance(null), null);
});
