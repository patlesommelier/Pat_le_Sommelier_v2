import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleVin, contenanceTarif, dedoublonner, prixPropose, vinDeLaCarte, vinTarif, type VinTarif } from '../src/lib/distributeurs/tarif';

const v = (x: Partial<VinTarif>): VinTarif => ({ section: null, producteur: null, libelle: 'x', millesime: null, contenance: null, couleur: null,
  certification: null, prix: null, epuise: false, maximum: null, ...x });

test('tarifs : vin lu par Claude remis en forme', () => {
  assert.deepEqual(vinTarif({ producteur: 'Domaine Clotilde Davenne', vin: 'Chablis', millesime: '2023', contenance: '37,5cl', prix: '11.28',
    couleur: 'Blanc', certification: 'rai', epuise: false, max: 5, section: 'Bourgogne' }),
  { section: 'Bourgogne', producteur: 'Domaine Clotilde Davenne', libelle: 'Chablis', millesime: '2023', contenance: '37,5 cl', couleur: 'blanc',
    certification: 'RAI', prix: 11.28, epuise: false, maximum: 5 });
  assert.equal(vinTarif({ vin: '' }), null);
  assert.equal(vinTarif({ vin: 'Champagne Rosé', millesime: 'NV', couleur: 'rosé' })!.millesime, null);
  assert.equal(vinTarif({ vin: 'Champagne Rosé', couleur: 'rosé' })!.couleur, 'rose');
  assert.equal(contenanceTarif('75 cl'), null);
  assert.equal(contenanceTarif('150'), '150 cl');
  assert.equal(contenanceTarif('300 CL'), '300 cl');
});

test('tarifs : un vin cité dans plusieurs listes du tarif ne compte qu’une fois', () => {
  const vins = dedoublonner([
    v({ producteur: 'Clotilde Davenne', libelle: 'Saint-Bris', millesime: '2024', prix: 11.72, section: 'Vins pour les Menus' }),
    v({ producteur: 'Domaine Clotilde Davenne', libelle: 'Saint-Bris', millesime: '2024', prix: 11.72, section: 'Bourgogne', certification: 'RAI' }),
    v({ producteur: 'Domaine Clotilde Davenne', libelle: 'Chablis', millesime: '2020', contenance: '150 cl', prix: 33.19, maximum: 6 }),
    v({ producteur: 'Domaine Clotilde Davenne', libelle: 'Chablis', millesime: '2020', contenance: '150 cl', prix: 33.19 }),
    v({ producteur: 'Domaine Clotilde Davenne', libelle: 'Chablis', millesime: '2024', prix: 18.22 }),
    v({ producteur: 'Domaine Brigandat', libelle: "Champagne 'Rosé'", prix: 26.68 }),
    v({ producteur: 'Domaine Follet-Ramillon', libelle: "Champagne 'Rosé'", prix: 26.68 }), // même nom et prix, autre domaine : gardé
  ]);
  assert.equal(vins.length, 5);
  const saintBris = vins.find((x) => x.libelle === 'Saint-Bris')!;
  assert.equal(saintBris.producteur, 'Domaine Clotilde Davenne');
  assert.equal(saintBris.certification, 'RAI');
  assert.equal(vins.find((x) => x.contenance === '150 cl')!.maximum, 6);
});

test('tarifs : clé stable d’un tarif à l’autre', () => {
  assert.equal(cleVin({ producteur: 'Domaine Clotilde Davenne', libelle: "Bourgogne 'Côtes d'Auxerre '", millesime: '2022', contenance: null }),
    cleVin({ producteur: 'Clotilde  Davenne', libelle: 'Bourgogne Côtes d’Auxerre', millesime: '2022', contenance: null }));
  assert.notEqual(cleVin({ producteur: 'X', libelle: 'Chablis', millesime: '2023', contenance: null }), cleVin({ producteur: 'X', libelle: 'Chablis', millesime: '2023', contenance: '37,5 cl' }));
});

test('tarifs : prix proposé aux restaurants', () => {
  assert.equal(prixPropose(10, 15), 11.5);
  assert.equal(prixPropose(11.28, 12.5), 12.69);
  assert.equal(prixPropose(10, 15, 9.9), 9.9);
  assert.equal(prixPropose(null, 15), null);
});

test('tarifs : vin du tarif retrouvé sur la carte du restaurant', () => {
  const carte = [
    { id: 'a', libelle: 'Chablis', millesime: '2024', format: '75 cl', producteur_id: 'p1', producteur: 'Domaine Davenne' },
    { id: 'b', libelle: 'Chablis', millesime: '2023', format: '37,5 cl', producteur_id: 'p1', producteur: 'Domaine Davenne' },
    { id: 'c', libelle: 'Chablis 1er Cru Vaucoupin', millesime: '2023', format: '75 cl', producteur_id: 'p1', producteur: null },
    { id: 'd', libelle: 'Vouvray sec', millesime: '2024', format: '75 cl', producteur_id: null, producteur: 'Vincent Carême' },
  ];
  const cat = (x: Partial<{ libelle: string; millesime: string | null; contenance: string | null; producteur_id: string | null; producteur: string | null }>) =>
    ({ id: 't', libelle: 'Chablis', millesime: '2024', contenance: null, producteur_id: 'p1', producteur: 'Domaine Clotilde Davenne', ...x });
  assert.equal(vinDeLaCarte(cat({}), carte)?.id, 'a');
  assert.equal(vinDeLaCarte(cat({ millesime: '2023', contenance: '37,5 cl' }), carte)?.id, 'b');
  assert.equal(vinDeLaCarte(cat({ libelle: "Chablis 1er Cru 'Vaucoupin'", millesime: '2023' }), carte)?.id, 'c');
  assert.equal(vinDeLaCarte(cat({ millesime: '2022' }), carte), null);
  assert.equal(vinDeLaCarte(cat({ millesime: '2023' }), carte), null); // « Chablis » n'est pas le 1er Cru Vaucoupin
  assert.equal(vinDeLaCarte(cat({ libelle: 'Vouvray sec', producteur_id: null, producteur: 'Vincent Carême' }), carte)?.id, 'd');
  assert.equal(vinDeLaCarte(cat({ libelle: 'Vouvray sec', producteur_id: null, producteur: 'Domaine Huet' }), carte), null);
});
