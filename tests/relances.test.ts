import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texteRelance } from '../src/lib/inscription/relances-texte';

const resto = { id: 'chez-lea', nom: 'Chez Léa', statut: 'en_service', email: 'lea@exemple.be', prenom: 'Léa', sans_prix: 0 };

test('relances : première relance, app prête, sans prix manquants', () => {
  const { sujet, texte } = texteRelance(resto, 1, 'https://exemple.be/admin/chez-lea');
  assert.match(sujet, /Chez Léa/);
  assert.match(texte, /^Bonjour Léa,/);
  assert.match(texte, /accords mets-vins sont prêts/);
  assert.doesNotMatch(texte, /prix/);
  assert.match(texte, /1\. Essayez-la/);
  assert.match(texte, /2\. Imprimez un chevalet/);
  assert.match(texte, /https:\/\/exemple\.be\/admin\/chez-lea/);
});

test('relances : accords en préparation, prix manquants, sans prénom', () => {
  const { texte } = texteRelance({ ...resto, statut: 'mise_en_place', prenom: null, sans_prix: 3 }, 1, 'https://x/admin/chez-lea');
  assert.match(texte, /^Bonjour,/);
  assert.match(texte, /termine encore quelques accords/);
  assert.match(texte, /2\. Vérifiez les 3 vins et plats/);
  assert.match(texte, /3\. Imprimez/);
});

test('relances : seconde relance', () => {
  const { sujet, texte } = texteRelance(resto, 2, 'https://x/admin/chez-lea');
  assert.match(sujet, /QR code/);
  assert.match(texte, /répondez simplement à cet e-mail/);
});
