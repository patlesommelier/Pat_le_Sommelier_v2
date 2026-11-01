import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memeVinQue } from '../src/lib/admin/doublons-recherche';

test('un vin de carte non relié qui est un vin de la base n’est pas proposé deux fois', () => {
  const carte = { libelle: "Molino a Vento Nero d'Avola Bio", producteur: 'Orestadi', couleur: 'rouge' };
  assert.equal(memeVinQue(carte, { libelle: "Nero d'Avola Bio", producteur: 'Molino a Vento', couleur: 'rouge' }), true);
  // Une autre cuvée du même domaine reste proposée
  assert.equal(memeVinQue(carte, { libelle: "Nero d'Avola", producteur: 'Molino a Vento', couleur: 'rouge' }), false);
  assert.equal(memeVinQue(carte, { libelle: "Nero d'Avola Bio", producteur: 'Molino a Vento', couleur: 'blanc' }), false);
  assert.equal(memeVinQue({ libelle: 'Chablis', producteur: null, couleur: null }, { libelle: 'Chablis Premier Cru', producteur: 'Fèvre', couleur: null }), false);
});
