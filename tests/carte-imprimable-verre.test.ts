import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organiser, OPTIONS_PAR_DEFAUT, type VinImprimable } from '../src/lib/carte-imprimable';

const vin = (id: string, couleur: VinImprimable['couleur'], region: string | null, prix: number, auVerre = false): VinImprimable => ({
  id, nom: id, producteur: null, millesime: null, contenance: null, couleur, region, prix, prixVerre: null, auVerre,
  presentation: null, presentationPerso: null, visible: true,
});

test('les vins au verre passent en tête de leur couleur', () => {
  const vins = [vin('a', 'blanc', 'Loire', 40), vin('b', 'blanc', 'Bourgogne', 60, true), vin('c', 'rouge', 'Rhône', 30), vin('d', 'rouge', 'Loire', 50, true)];
  const g = organiser(vins, OPTIONS_PAR_DEFAUT);
  assert.deepEqual(g.map((c) => c.regions.map((r) => [r.nom, r.vins.map((v) => v.id)])), [
    [['Au verre', ['b']], ['Loire', ['a']]],
    [['Au verre', ['d']], ['Rhône', ['c']]],
  ]);
  const p = organiser(vins, { ...OPTIONS_PAR_DEFAUT, ordre: 'prix' });
  assert.deepEqual(p[0].regions.map((r) => [r.nom, r.vins.map((v) => v.id)]), [['Au verre', ['b']], ['À la bouteille', ['a']]]);
});
