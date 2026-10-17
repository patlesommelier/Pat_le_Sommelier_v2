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

test('un cépage écrit d’un seul côté (carte ou base) n’empêche pas de retrouver la cuvée', () => {
  const jaboulet = [
    { id: 'sdf', nom: 'Secret de Famille', couleur: 'blanc', appellation: 'IGP Collines Rhodaniennes' },
    { id: 'ch', nom: 'Hermitage La Chapelle Blanc', couleur: 'blanc', appellation: 'Hermitage' },
  ];
  const j = (libelle: string) => vin(libelle, 'blanc', null, 'Paul Jaboulet Aîné');
  assert.equal(cuveeCorrespondante(j('Viognier Secret de Famille Jaboulet'), jaboulet)?.id, 'sdf');
  assert.equal(cuveeCorrespondante(j('Secret de Famille'), [{ id: 'v', nom: 'Viognier Secret de Famille', couleur: 'blanc' }])?.id, 'v');
  // Une cuvée nommée par son seul cépage n'attrape pas une autre cuvée du même cépage.
  assert.equal(cuveeCorrespondante(j('Viognier Secret de Famille'), [{ id: 'v', nom: 'Viognier', couleur: 'blanc' }]), null);
  assert.equal(cuveeCorrespondante(j('Viognier'), [{ id: 'v', nom: 'Viognier', couleur: 'blanc' }])?.id, 'v');
});

test('le pays en tête de ligne ne gêne pas', () => {
  assert.equal(cuveeCorrespondante(vin('Allemagne - Riesling "Eisquell" - Weingut Battenfeld Spanier', 'blanc', null, 'Battenfeld-Spanier'),
    [{ id: 'e', nom: 'Eisquell Riesling', couleur: 'blanc' }, { id: 'k', nom: 'Kirchspiel Riesling GG', couleur: 'blanc' }])?.id, 'e');
});

test('carte sans nom de cuvée : le seul vin du producteur dans cette couleur et cette appellation', () => {
  const mourgues = [
    { id: 'tab', nom: 'Terre d’Argence', couleur: 'blanc', appellation: 'Costières de Nîmes' },
    { id: 'gal', nom: 'Les Galets Rouges', couleur: 'rouge', appellation: 'Costières de Nîmes' },
    { id: 'gro', nom: 'Les Galets Rosés', couleur: 'rose', appellation: 'Costières de Nîmes' },
  ];
  const m = (couleur: string) => vin('Costières de Nîmes', couleur, null, 'Château Mourgues du Grès');
  assert.equal(cuveeCorrespondante(m('blanc'), mourgues)?.id, 'tab');
  // Deux rouges dans la même appellation : on ne choisit pas.
  assert.equal(cuveeCorrespondante(m('rouge'), [...mourgues, { id: 'cap', nom: 'Capitelles', couleur: 'rouge', appellation: 'Costières de Nîmes' }]), null);
  // Rien sur la carte que le nom du producteur : on ne devine pas.
  assert.equal(cuveeCorrespondante(vin('Château Mourgues du Grès', 'blanc', null, 'Château Mourgues du Grès'), mourgues), null);
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
