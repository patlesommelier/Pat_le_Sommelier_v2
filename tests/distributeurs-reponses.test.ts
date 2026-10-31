import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraireVins } from '../src/lib/distributeurs/lecture';

test('réponses de Claude : vins lus même quand la réponse n’est pas parfaite', () => {
  assert.deepEqual(extraireVins('{"vins": [{"vin": "Chablis", "prix": 18.22}]}'), [{ vin: 'Chablis', prix: 18.22 }]);
  assert.deepEqual(extraireVins('```json\n[{"vin": "Chablis"}]\n```'), [{ vin: 'Chablis' }]);
  assert.deepEqual(extraireVins('Voici les vins :\n{"vins": []}'), []);
  assert.deepEqual(extraireVins('Cette page ne contient que les conditions de vente : aucun vin.'), []);
  // Réponse coupée en plein milieu : les vins complets sont gardés.
  assert.deepEqual(extraireVins('{"vins": [{"vin": "Chablis", "prix": 18.22}, {"vin": "Irancy", "prix": 19.53}, {"vin": "Vezel'),
    [{ vin: 'Chablis', prix: 18.22 }, { vin: 'Irancy', prix: 19.53 }]);
  // Un guillemet mal échappé abîme un vin : les autres restent.
  assert.deepEqual(extraireVins('[{"vin": "Vezelay "Natur"}, {"vin": "Saint-Bris", "prix": 11.72}]'), [{ vin: 'Saint-Bris', prix: 11.72 }]);
  assert.equal(extraireVins('[{ illisible'), null);
});
