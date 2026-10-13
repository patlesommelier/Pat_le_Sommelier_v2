// Règle 2c : un coup de cœur de la maison gagne un point au score (si la règle est active).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGLAGES_PAT, selectionner, type Candidat } from '../src/lib/selection';

const vin = (id: string, note: number, coeur = false): Candidat => ({
  id, libelle: id, couleur: 'rouge', format: '75 cl', prix: 40, ordre: 1, ranking_producteur: 3, ranking_terroir: 3,
  pays: 'France', cepages: id, appellation: id, notes: { p: note }, coup_de_coeur: coeur,
});

test('coup de cœur : + 1 au score quand la règle est active', () => {
  const vins = [vin('a', 4), vin('b', 4, true)];
  const actif = selectionner(vins, ['p'], { reglages: { ...REGLAGES_PAT, bonusCoupDeCoeur: true } });
  assert.equal(actif.classement[0].vin.id, 'b');
  assert.equal(actif.classement[0].score, 8);
  const inactif = selectionner(vins, ['p'], { reglages: { ...REGLAGES_PAT, bonusCoupDeCoeur: false } });
  assert.equal(inactif.classement.find((r) => r.vin.id === 'b')!.score, 7);
});
