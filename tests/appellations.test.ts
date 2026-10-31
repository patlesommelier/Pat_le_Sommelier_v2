import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appellationProche, cleAppellation, distance, doublons } from '../src/lib/appellations/regroupement';

test('appellations : même clé malgré mentions, accents et tirets', () => {
  assert.equal(cleAppellation('Bourgogne-Aligoté AOC'), 'bourgogne aligote');
  assert.equal(cleAppellation('AOC Saint-Joseph'), cleAppellation('St Joseph'));
  assert.equal(cleAppellation('Crozes-Hermitage'), cleAppellation('Crozes Hermitage AOP'));
  assert.equal(distance('sancerre', 'sancere'), 1);
  assert.equal(distance('chablis', 'chinon'), 3);
});

test('appellations : doublons probables regroupés, celle à garder d’abord', () => {
  const a = (id: string, nom: string, statut = 'valide', vins = 0) => ({ id, nom, statut, vins });
  const g = doublons([
    a('1', 'Bourgogne Aligoté', 'valide', 12), a('2', 'Bourgogne-Aligoté AOC', 'propose', 1), a('3', 'Sancerre', 'valide', 30),
    a('4', 'Sancere', 'propose'), a('5', 'Chablis'), a('6', 'Chinon'), a('7', 'Côte-Rôtie'), a('8', 'Côte Rôtie', 'retire'),
    a('9', 'Pouilly-Fumé', 'propose', 2), a('10', 'Pouilly-Fuissé', 'valide', 5),
  ]);
  assert.deepEqual(g.map((x) => x.map((y) => y.id)), [['1', '2'], ['3', '4']]); // pas Chablis/Chinon, pas une retirée, pas Fumé/Fuissé
  const r = (id: string, nom: string, region: string) => ({ id, nom, statut: 'valide', vins: 0, region });
  assert.deepEqual(doublons([r('a', 'Steinberg', 'Rheingau'), r('b', 'Steinberg', 'Hessische Bergstraße'),
    r('c', 'Oberrotweiler Eichberg', 'Baden'), r('d', 'Oberrotweiler Kirchberg', 'Baden'), r('e', 'Calvario', 'La Rioja'), r('f', 'Calvarino', 'Veneto')]), []);
});

test('appellations : appellation de la base la plus proche d’un nom saisi', () => {
  const base = [{ id: 'a', nom: 'Saint-Émilion Grand Cru', statut: 'valide' }, { id: 'b', nom: 'Sancerre', statut: 'valide' }];
  assert.equal(appellationProche('Saint Emilion Grand Cru AOC', base)?.id, 'a');
  assert.equal(appellationProche('Sancere', base)?.id, 'b');
  assert.equal(appellationProche('Menetou-Salon', base), null);
});
