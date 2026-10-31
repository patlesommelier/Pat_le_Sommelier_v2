import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadreEnPixels, cadreValide } from '../src/lib/distributeurs/recadrage';

test('recadrage : cadre de l’étiquette vérifié, puis converti en pixels avec une marge', () => {
  assert.deepEqual(cadreValide({ x: 0.3, y: 0.52, largeur: 0.4, hauteur: 0.3 }), { x: 0.3, y: 0.52, largeur: 0.4, hauteur: 0.3 });
  assert.equal(cadreValide({ x: 0.3, y: 0.5, largeur: 0.02, hauteur: 0.3 }), null); // trop étroit
  assert.equal(cadreValide({ x: 1.5, y: 0.5, largeur: 0.2, hauteur: 0.3 }), null);
  assert.equal(cadreValide({ deja: true }), null);
  assert.equal(cadreValide(null), null);
  assert.deepEqual(cadreEnPixels({ x: 0.25, y: 0.5, largeur: 0.5, hauteur: 0.25 }, 400, 1000, 0), { left: 100, top: 500, width: 200, height: 250 });
  const p = cadreEnPixels({ x: 0, y: 0.9, largeur: 1, hauteur: 0.1 }, 400, 1000);
  assert.ok(p.left === 0 && p.top + p.height <= 1000 && p.left + p.width <= 400);
});
