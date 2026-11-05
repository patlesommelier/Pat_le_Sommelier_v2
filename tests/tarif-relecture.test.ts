// Relecture d'un tarif de distributeur : les vins déjà lus sont retrouvés même si la lecture les écrit autrement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleVin, recalerCles, type LigneCle } from '../src/lib/distributeurs/tarif';

const ligne = (producteur: string | null, libelle: string, millesime: string | null = '2022', contenance: string | null = null): LigneCle => ({
  cle: cleVin({ producteur, libelle, millesime, contenance, reference: null }), producteur, libelle, millesime, contenance });

test('producteur écrit dans le nom du vin : même vin', () => {
  const avant = ligne('Clos Teisseire', 'Vue du Ciel');
  const apres = ligne(null, 'Clos Teisseire Vue du Ciel');
  assert.notEqual(avant.cle, apres.cle);
  assert.equal(recalerCles([apres], [avant]).get(apres.cle), avant.cle);
});

test('un mot en plus (Domaine…) : même vin', () => {
  const avant = ligne('Clos Teisseire', 'Vue du Ciel');
  const apres = ligne('Domaine du Clos Teisseire', 'Vue du Ciel rouge');
  assert.equal(recalerCles([apres], [avant]).get(apres.cle), avant.cle);
});

test('autre millésime, ou deux vins possibles : rien', () => {
  const avant = ligne('Clos Teisseire', 'Vue du Ciel', '2021');
  assert.equal(recalerCles([ligne(null, 'Clos Teisseire Vue du Ciel', '2022')], [avant]).size, 0);
  const a = ligne('Teisseire', 'Vue du Ciel blanc'), b = ligne('Teisseire', 'Vue du Ciel rouge');
  assert.equal(recalerCles([ligne(null, 'Teisseire Vue du Ciel')], [a, b]).size, 0);
});

test('clé inchangée : rien à recaler', () => {
  const l = ligne('Clos Teisseire', 'Vue du Ciel');
  assert.equal(recalerCles([l], [l]).size, 0);
});

import { cuveeDuVinSouple } from '../src/lib/distributeurs/rattachement';

test('vin du tarif relié à sa cuvée même écrit autrement, jamais à une autre couleur', () => {
  const cuvees = [
    { id: 'vue', producteur_id: 'p', nom: 'Vue du Ciel', appellation: null },
    { id: 'igp', producteur_id: 'p', nom: 'IGP Haute vallée de l’Aude - Clos Teisseire - Chardonnay, Chenin', appellation: null },
    { id: 'blanc', producteur_id: 'p', nom: 'Cévennes Etincelle Nomade blanc', appellation: null },
  ];
  const v = (libelle: string, appellation: string | null = null) => ({ libelle, producteur_texte: 'Clos Teisseire', appellation });
  assert.equal(cuveeDuVinSouple(v('IGP Haute Vallée de l’Aude Vue du Ciel', 'IGP Haute Vallée de l’Aude'), cuvees, 'Clos Teisseire')?.id, 'vue');
  assert.equal(cuveeDuVinSouple(v('Cévennes Etincelle Nomade rosé'), cuvees, 'Clos Teisseire'), null);
  assert.equal(cuveeDuVinSouple(v('Cévennes Etincelle Nomade blanc'), cuvees, 'Clos Teisseire')?.id, 'blanc');
});

test('appellation inconnue devant le nom de la cuvée : retrouvée par la fin du nom', () => {
  const cuvees = [{ id: 'vue', producteur_id: 'p', nom: 'Vue du Ciel', appellation: null }, { id: 'autre', producteur_id: 'p', nom: 'Les Hauts', appellation: null }];
  assert.equal(cuveeDuVinSouple({ libelle: 'IGP Haute Vallée de l’Aude Vue du Ciel', producteur_texte: 'Clos Teisseire' }, cuvees, 'Clos Teisseire')?.id, 'vue');
  assert.equal(cuveeDuVinSouple({ libelle: 'Vue du Ciel rosé', producteur_texte: 'Clos Teisseire' }, cuvees, 'Clos Teisseire'), null);
});
