import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuveeCorrespondante } from '../src/lib/etiquettes/partage';

const ruinart = [
  { id: 'r', nom: 'Champagne R de Ruinart', couleur: 'bulles' },
  { id: 'bdb', nom: 'Champagne Ruinart Blanc de Blancs', couleur: 'blanc' },
  { id: 'dom-bdb', nom: 'Champagne Dom Ruinart Blanc de Blancs', couleur: 'blanc' },
  { id: 'rose', nom: 'Champagne Ruinart Rosé', couleur: 'rose' },
];
const vin = (libelle: string, couleur = 'bulles', vin_texte: string | null = null, producteur_nom = 'Ruinart') => ({ libelle, couleur, vin_texte, producteur_nom });

test('la cuvée de la carte retrouve la cuvée de la base, aux mentions génériques près', () => {
  assert.equal(cuveeCorrespondante(vin('Champagne R de Ruinart Brut'), ruinart)?.id, 'r');
  assert.equal(cuveeCorrespondante(vin('Champagne Ruinart Blanc de Blancs'), ruinart)?.id, 'bdb');
  assert.equal(cuveeCorrespondante(vin('Champagne Ruinart Rosé'), ruinart)?.id, 'rose');
});

test('pas de rattachement approximatif', () => {
  assert.equal(cuveeCorrespondante(vin('Champagne Ruinart'), ruinart), null);
  assert.equal(cuveeCorrespondante(vin('Sancerre Henri Bourgeois', 'blanc', null, 'Henri Bourgeois'),
    [{ id: 'b', nom: 'Sancerre La Bourgeoise', couleur: null }]), null);
  // Même nom mais couleur différente : un rouge n'est pas un blanc.
  assert.equal(cuveeCorrespondante(vin('Beaune 1er Cru Clos des Mouches', 'rouge', null, 'Domaine Chanson'),
    [{ id: 'm', nom: 'Beaune 1er Cru Clos des Mouches', couleur: 'blanc' }]), null);
});

test("l'appellation de la cuvée complète son nom", () => {
  assert.equal(cuveeCorrespondante(vin('Meursault Les Tessons', 'blanc', null, 'Domaine Pierre Morey'),
    [{ id: 't', nom: 'Les Tessons', couleur: 'blanc', appellation: 'Meursault' }])?.id, 't');
});

test("l'appellation du vin n'empêche pas de retrouver une cuvée nommée sans elle", () => {
  assert.equal(cuveeCorrespondante({ ...vin('Champagne Dom Pérignon Vintage', 'bulles', null, 'Dom Pérignon'), appellation_nom: 'Champagne' },
    [{ id: 'dp', nom: 'Dom Pérignon Vintage', couleur: null }])?.id, 'dp');
});

test('étiquette d’un vin sans producteur : même clé pour le même vin, aux accents et majuscules près', async () => {
  const { cleLibelle } = await import('../src/lib/etiquettes/partage');
  assert.equal(cleLibelle('Champagne Brut Réserve', 'bulles'), cleLibelle('champagne  brut reserve', 'bulles'));
  assert.notEqual(cleLibelle('Champagne Brut Réserve', 'bulles'), cleLibelle('Champagne Brut Réserve', 'blanc'));
});
