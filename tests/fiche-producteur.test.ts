import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraitFiche } from '../src/lib/fiche-producteur';

test('extrait de la fiche : début public, sans cuisine interne', () => {
  const fiche = '**Plus ancienne maison de Champagne** — **fondée en 1729** par Nicolas Ruinart, propriété de LVMH depuis 1963. '
    + '**Spécialiste historique du Blanc de Blancs** (Chardonnay 100%) : c’est la signature de la maison. Caves dans les crayères gallo-romaines classées UNESCO. '
    + 'Cuvées : R de Ruinart 60-70 €, Blanc de Blancs 90 €. Style élégant, tendu, d’une grande précision, vinifications soignées et dégorgements tardifs. '
    + '**Profil Pat — iconique** : (1) une maison de référence.';
  const e = extraitFiche(fiche)!;
  assert.ok(e.startsWith('Plus ancienne maison de Champagne — fondée en 1729'));
  assert.ok(!/\*|€|Profil|iconique/.test(e), e);
  assert.ok(e.includes('Style élégant, tendu'));
  assert.equal(extraitFiche('Trop court.'), null);
});
