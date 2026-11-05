// Reconnaissance des vins lus sur la carte dans la base de Pat (cuvée du producteur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuveeReconnue } from '../src/lib/inscription/reconnaissance';

const CUVEES = [
  { id: 'a', producteur_id: 'p', nom: "Crémant d'Alsace Zéro Dosage", appellation: "Crémant d'Alsace" },
  { id: 'b', producteur_id: 'p', nom: "Crémant d'Alsace Brut", appellation: "Crémant d'Alsace" },
  { id: 'c', producteur_id: 'p', nom: 'Riesling Grand Cru Brand', appellation: 'Brand' },
  { id: 'd', producteur_id: 'p', nom: 'Trebbiano d’Abruzzo', appellation: 'Trebbiano d’Abruzzo' },
];
const vin = (libelle: string) => ({ libelle, producteur_texte: 'Domaine Achillée' });

test('nom identique : reconnu', () => assert.equal(cuveeReconnue(vin('Riesling Grand Cru Brand'), CUVEES, 'Domaine Achillée')?.id, 'c'));
test('carte qui abrège l’appellation : reconnu', () => assert.equal(cuveeReconnue(vin('Crémant Zéro Dosage Achillée'), CUVEES, 'Domaine Achillée')?.id, 'a'));
test('mot inconnu de la cuvée : pas reconnu', () => assert.equal(cuveeReconnue(vin('Cuvée Mystère'), CUVEES, 'Domaine Achillée'), null));
test('plusieurs cuvées possibles : pas reconnu', () => assert.equal(cuveeReconnue(vin('Crémant'), CUVEES, 'Domaine Achillée'), null));
test('cuvée qui ne porte que l’appellation : appellation entière exigée', () => {
  assert.equal(cuveeReconnue(vin('Trebbiano d’Abruzzo'), CUVEES, 'Domaine Achillée')?.id, 'd');
  assert.equal(cuveeReconnue(vin('Trebbiano'), CUVEES, 'Domaine Achillée'), null);
});
