import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trouverAccords, type AccordReference } from '../src/lib/app/recherche';

const { items } = JSON.parse(readFileSync('data/app/accords-reference.json', 'utf8')) as { items: AccordReference[] };

test('la question trouve le plat de référence', () => {
  assert.equal(trouverAccords('Je mange des asperges ce soir', items)[0]?.id, 'asperges');
  assert.ok(trouverAccords('magret de canard', items)[0]?.nom.toLowerCase().includes('magret'));
});

test('une question sans plat ne trouve rien', () => {
  assert.deepEqual(trouverAccords('bonjour, que me conseilles-tu ?', items), []);
});
