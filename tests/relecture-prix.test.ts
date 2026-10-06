// Relecture des prix du menu : chaque plat du restaurant est retrouvé par son nom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { associerPrix } from '../src/lib/inscription/prix';

test('les prix lus sur le menu vont aux bons plats, même avec des accents ou des mots en plus', () => {
  const plats = [
    { id: 'a', nom: 'Croquettes de crevettes grises' },
    { id: 'b', nom: 'Burger Happy’s, frites' },
    { id: 'c', nom: 'Filet pur, sauce morilles' },
    { id: 'd', nom: 'Filet pur, sauce poivre vert' },
    { id: 'e', nom: 'Tiramisu' },
  ];
  const r = associerPrix(plats, [
    { nom: 'Croquettes aux crevettes grises', prix: 15, prixVariantes: '1 pièce 15 € / 2 pièces 27 €' },
    { nom: 'BURGER HAPPY’S – frites', prix: 19 },
    { nom: 'Filet pur sauce poivre vert', prix: 44 },
    { nom: 'Filet pur sauce morilles', prix: 46 },
    { nom: 'Café gourmand', prix: 11 },
  ]);
  assert.equal(r.get('a')?.prix, 15);
  assert.equal(r.get('b')?.prix, 19);
  assert.equal(r.get('c')?.prix, 46);
  assert.equal(r.get('d')?.prix, 44);
  assert.equal(r.has('e'), false);
});
