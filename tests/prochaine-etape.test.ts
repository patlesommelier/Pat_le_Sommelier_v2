import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carteValidee, caveVisible, prochaineEtape, type EtatRestaurant } from '../src/lib/admin/prochaine-etape';

const rien: EtatRestaurant = { commandesAVoir: 0, accordsARelire: 0, vinsSansPrix: 0, cave: true, vinsStockBas: 0, inventaireARefaire: false, inventaireIlYA: null, apparenceAChoisir: false };

test('prochaine étape : rien à faire', () => assert.equal(prochaineEtape(rien), null));

test('prochaine étape : la plus urgente d’abord', () => {
  const tout = { ...rien, commandesAVoir: 1, accordsARelire: 12, vinsSansPrix: 2, vinsStockBas: 3, inventaireARefaire: true, apparenceAChoisir: true };
  assert.equal(prochaineEtape(tout)?.chemin, '/commandes');
  assert.equal(prochaineEtape({ ...tout, commandesAVoir: 0 })?.titre, 'Relire 12 accords de Pat');
  assert.equal(prochaineEtape({ ...tout, commandesAVoir: 0, accordsARelire: 0 })?.titre, '2 vins n’ont pas de prix');
  assert.equal(prochaineEtape({ ...tout, commandesAVoir: 0, accordsARelire: 0, vinsSansPrix: 0 })?.chemin, '/stocks?filtre=bas');
  assert.equal(prochaineEtape({ ...rien, inventaireARefaire: true, inventaireIlYA: 'il y a 9 jours' })?.titre, 'Dernier inventaire il y a 9 jours');
  assert.equal(prochaineEtape({ ...rien, apparenceAChoisir: true })?.chemin, '/apparence');
});

test('prochaine étape : pas de cave, pas d’étape de cave', () => {
  assert.equal(prochaineEtape({ ...rien, cave: false, vinsStockBas: 4, inventaireARefaire: true }), null);
});

test('cave visible et carte validée, selon le statut de l’espace', () => {
  // Vert (actif) et rouge (test) : tout est ouvert ; jaune (inscription) : cave et impression fermées.
  assert.equal(caveVisible({ mode: 'actif' }), true);
  assert.equal(caveVisible({ mode: 'test' }), true);
  assert.equal(caveVisible({ mode: 'inscription' }), false);
  assert.equal(carteValidee({ mode: 'actif' }), true);
  assert.equal(carteValidee({ mode: 'inscription' }), false);
});
