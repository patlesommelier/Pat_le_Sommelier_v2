import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presentationPublique } from '../src/lib/producteurs/presentation';

test('présentation du producteur : rien de ce qui est réservé à Pat', () => {
  const t = '**Le ciseleur du granite**, un grand domaine. Classé parmi les meilleurs d’Alsace. Vignes âgées.\n\nPrix : 20-30 €. **Profil Pat — iconique** : (1) conviction n°3.';
  const p = presentationPublique(t).join(' ');
  assert.ok(!/Pat|iconique|conviction|\*\*|Classé/.test(p), p);
  assert.match(p, /Le ciseleur du granite, un grand domaine\./);
  assert.match(p, /Vignes âgées\./);
});
