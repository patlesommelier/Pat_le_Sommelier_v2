import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appellationDeduite, composerIntitule, nomDeduit } from '../src/lib/admin/intitule';

test('intitulé : appellation puis nom du vin', () => {
  assert.equal(composerIntitule({ appellation: 'Chablis AOC', nom: 'Saint-Pierre', cepage: 'Chardonnay', producteur: 'Régnard' }), 'Chablis Saint-Pierre');
});

test('intitulé : le producteur quand le vin n’a pas de nom', () => {
  assert.equal(composerIntitule({ appellation: 'Chiroubles', nom: '', cepage: 'Gamay', producteur: 'Domaine Piron' }), 'Chiroubles Domaine Piron');
});

test('intitulé : le cépage pour une appellation générique', () => {
  assert.equal(composerIntitule({ appellation: 'IGP Val de Loire', nom: 'Le Petit Bourgeois', cepage: 'Sauvignon' }), 'IGP Val de Loire Sauvignon Le Petit Bourgeois');
  assert.equal(composerIntitule({ appellation: 'IGP Val de Loire', nom: 'Le Petit Bourgeois Sauvignon', cepage: 'Sauvignon blanc' }), 'IGP Val de Loire Le Petit Bourgeois Sauvignon');
  assert.equal(composerIntitule({ appellation: 'Vin de France', nom: 'X', cepage: 'Merlot, Syrah' }), 'Vin de France X');
});

test('intitulé : rien n’est répété', () => {
  assert.equal(composerIntitule({ appellation: 'Pomerol', nom: 'Pomerol Clos René' }), 'Pomerol Clos René');
  assert.equal(composerIntitule({ appellation: '', nom: '', producteur: '' }), '');
});

test('champs lus sur la carte à l’import', () => {
  const t = 'Etna Bianco DOC (probable) – « Vendemia » (mention à préciser)';
  assert.equal(appellationDeduite(t), 'Etna Bianco');
  assert.equal(nomDeduit(t), 'Vendemia');
  assert.equal(nomDeduit('Sancerre rouge – cuvée non précisée'), '');
  assert.equal(appellationDeduite('x', 'Crozes-Hermitage AOC'), 'Crozes-Hermitage');
});
