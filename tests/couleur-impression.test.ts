import { test } from 'node:test';
import assert from 'node:assert/strict';
import { couleurDominante, couleurImpression } from '../src/lib/couleurs';

const image = (pixels: [number, number, number, number][]) => Uint8Array.from(pixels.flat());

test('la couleur dominante d’un logo bleu foncé sur fond blanc', () => {
  const px: [number, number, number, number][] = [...Array(200).fill([255, 255, 255, 255]), ...Array(80).fill([20, 40, 110, 255]), ...Array(10).fill([230, 30, 30, 255])];
  assert.equal(couleurDominante(image(px)), '#14286E');
  assert.equal(couleurDominante(image(Array(100).fill([255, 255, 255, 255]))), null);
});

test('la couleur imprimée : celle de l’app si elle se lit, sinon celle du logo', () => {
  assert.equal(couleurImpression('#1B2A5C', '#C8102E'), '#1B2A5C'); // fond bleu foncé : gardé
  assert.equal(couleurImpression('#F2D16B', '#14286E'), '#14286E'); // fond jaune, logo bleu foncé : le bleu
  assert.equal(couleurImpression('#F2D16B', '#FFE08A'), '#F2D16B'); // rien de foncé : la couleur de l'app
});
