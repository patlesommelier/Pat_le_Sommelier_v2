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

// Règle 2b : à score égal, un autre vin passe avant une bulle (active par défaut, désactivable).
test('bulles après : à score égal, l’autre vin passe devant la bulle', () => {
  const b: Candidat = { ...vin('bulle', 4), couleur: 'bulles', ordre: 1 };
  const r: Candidat = { ...vin('rouge', 4), ordre: 2 };
  const actif = selectionner([b, r], ['p'], { reglages: { ...REGLAGES_PAT } });
  assert.equal(REGLAGES_PAT.bullesApres, true);
  assert.deepEqual(actif.liste.map((x) => x.vin.id), ['rouge', 'bulle']);
  // Désactivée : l'ordre de la carte départage, la bulle (1re sur la carte) passe devant.
  const inactif = selectionner([b, r], ['p'], { reglages: { ...REGLAGES_PAT, bullesApres: false } });
  assert.equal(inactif.liste[0].vin.id, 'bulle');
  // Une bulle mieux classée reste devant.
  const meilleure = selectionner([{ ...b, notes: { p: 5 } }, r], ['p'], { reglages: { ...REGLAGES_PAT } });
  assert.equal(meilleure.liste[0].vin.id, 'bulle');
});
