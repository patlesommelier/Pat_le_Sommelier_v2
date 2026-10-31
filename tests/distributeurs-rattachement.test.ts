import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuveeDuVin, suggererProducteurs, type ProducteurBase } from '../src/lib/distributeurs/rattachement';

const base: ProducteurBase[] = [
  { id: 'davenne', nom: 'Domaine Clotilde Davenne', region: 'Bourgogne', ranking_pat: 4, statut: 'valide' },
  { id: 'davenne-2', nom: 'Davenne Frères', region: 'Bourgogne', ranking_pat: null, statut: 'propose' },
  { id: 'saint-jean', nom: 'Domaine Saint-Jean', region: 'Rhône', ranking_pat: 2, statut: 'valide' },
  { id: 'carme', nom: 'Domaine Vincent Carême', region: 'Loire', ranking_pat: 5, statut: 'valide' },
  { id: 'duport', nom: 'Domaine Yves Duport', region: 'Jura', ranking_pat: 3, statut: 'valide' },
  { id: 'cuilleron', nom: 'Domaine Yves Cuilleron', region: 'Rhône', ranking_pat: 3, statut: 'valide' },
  { id: 'peron', nom: 'Domaine Jean-Yves Péron', region: 'Savoie', ranking_pat: 5, statut: 'valide' },
  { id: 'vincent-1', nom: 'Domaine Vincent Dauvissat', region: 'Bourgogne', ranking_pat: 5, statut: 'valide' },
  { id: 'vincent-2', nom: 'Vincent Paris', region: 'Rhône', ranking_pat: 4, statut: 'valide' },
];

test('rattachement : producteurs proches proposés, le plus proche d’abord', () => {
  const s = suggererProducteurs('Clotilde Davenne', base);
  assert.deepEqual(s.map((x) => x.id), ['davenne']); // « Davenne Frères » : un autre domaine
  assert.equal(s[0].ranking_pat, 4);
  assert.deepEqual(suggererProducteurs('Domaine Saint-Jean de Bébian', base).map((x) => x.id), ['saint-jean']); // seul « Saint-Jean » de la base
  assert.deepEqual(suggererProducteurs('Tania & Vincent Carême', base).map((x) => x.id), ['carme']);
  assert.deepEqual(suggererProducteurs('', base), []);
  assert.deepEqual(suggererProducteurs('Domaine Yves Boyer - Martenot', base), []); // « Yves » seul ne suffit pas
  assert.deepEqual(suggererProducteurs('Yves Cuilleron', base).map((x) => x.id), ['cuilleron']);
});

test('rattachement : vin du tarif retrouvé parmi les cuvées du producteur', () => {
  const cuvees = [
    { id: 'c1', producteur_id: 'davenne', nom: 'Chablis', appellation: 'Chablis' },
    { id: 'c2', producteur_id: 'davenne', nom: 'Vaucoupin', appellation: 'Chablis 1er Cru' },
    { id: 'c3', producteur_id: 'davenne', nom: 'Chablis Domaine Clotilde Davenne', appellation: null },
  ];
  assert.equal(cuveeDuVin({ libelle: "Chablis 1er Cru 'Vaucoupin'", producteur_texte: 'Domaine Clotilde Davenne' }, cuvees, 'Domaine Clotilde Davenne')?.id, 'c2');
  // Deux cuvées « Chablis » (l'une avec le nom du domaine) : doute, aucune.
  assert.equal(cuveeDuVin({ libelle: 'Chablis', producteur_texte: 'Clotilde Davenne' }, cuvees, 'Domaine Clotilde Davenne'), null);
  assert.equal(cuveeDuVin({ libelle: 'Chablis', producteur_texte: 'Clotilde Davenne' }, cuvees.slice(0, 2), 'Domaine Clotilde Davenne')?.id, 'c1');
  assert.equal(cuveeDuVin({ libelle: 'Saint-Bris', producteur_texte: 'Clotilde Davenne' }, cuvees, 'Domaine Clotilde Davenne'), null);
});
