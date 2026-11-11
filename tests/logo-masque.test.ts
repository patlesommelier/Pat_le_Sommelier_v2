import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logoPourMasque } from '../src/lib/logo-masque';

test('logo pour masque : un logo du stockage passe par le site, un logo du site reste tel quel', () => {
  assert.equal(logoPourMasque('https://logos.exemple.be/r/lola.png'), '/api/logo?u=https%3A%2F%2Flogos.exemple.be%2Fr%2Flola.png');
  assert.equal(logoPourMasque('/restaurants/lola/logo.png'), '/restaurants/lola/logo.png');
});
