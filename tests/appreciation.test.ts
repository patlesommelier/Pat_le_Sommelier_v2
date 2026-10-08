// Appréciation ajoutée aux commentaires d'accord selon la note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avecAppreciation } from '../src/lib/appreciation';

const texte = 'Pétillant et sec, le Cava La Rosca brut tranche le gras de la friture et rafraîchit le fromage fondant.';

test('plus la note est haute, plus l’appréciation est enthousiaste ; jamais sur un texte du restaurant', () => {
  const r4 = avecAppreciation(texte, 4, { cle: 'plat' })!;
  assert.match(r4, /^Pétillant et sec, .* fromage fondant, .+\.$/);
  assert.ok(!r4.includes('fondant.,'));
  assert.equal(avecAppreciation(texte, 2), texte);
  assert.equal(avecAppreciation(texte, 5, { ecritParLeRestaurant: true }), texte);
  assert.equal(avecAppreciation(null, 5), null);
  // Trois vins d'un même plat : trois formules différentes.
  const trois = [0, 1, 2].map((position) => avecAppreciation(texte, 4, { cle: 'plat-x', position }));
  assert.equal(new Set(trois).size, 3);
});
