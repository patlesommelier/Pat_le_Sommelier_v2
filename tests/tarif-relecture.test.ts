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
