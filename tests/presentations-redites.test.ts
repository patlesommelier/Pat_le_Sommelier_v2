import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trouverDoublons } from '../src/lib/generation/presentations';

test('la même phrase de table d’un vin à l’autre est une redite', () => {
  const d = trouverDoublons([
    { id: 'sancerre', texte: 'Roger Neveu élabore ce Sancerre 2021 en Cuvée Vieilles Vignes, des ceps âgés qui donnent des raisins concentrés. Le Sauvignon Blanc y offre sa tension vive, avec des parfums d’agrumes. Il brille avec les poissons, les crustacés et les fromages de chèvre.' },
    { id: 'riesling', texte: 'En Alsace, le Domaine Jean-Luc Mader signe ce Riesling 2024, issu d’un seul cépage. Ce raisin vif offre une fraîcheur nette et des parfums de fleurs blanches. À table, il met en valeur les poissons, les fruits de mer et les fromages de chèvre.' },
    { id: 'rouge', texte: 'Sur les granites du Beaujolais, ce gamay pousse lentement et garde un fruit croquant. Sa trame légère vient de la macération courte. Il accompagne la terrine de campagne et le boudin aux pommes.' },
  ]);
  assert.deepEqual(d, [['sancerre', 'riesling']]);
});
