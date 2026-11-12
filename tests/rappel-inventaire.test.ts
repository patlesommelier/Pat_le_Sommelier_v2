import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rappelDu, texteRappelInventaire } from '../src/lib/inscription/rappel-inventaire-texte';
import { inventaireARefaire } from '../src/lib/admin/inventaire';

// Lundi 2 novembre 2026 (1er lundi du mois), lundi 9 et 16 novembre ; heure d'hiver à Bruxelles (UTC+1).
const lundi = (j: number, h: number) => new Date(Date.UTC(2026, 10, j, h - 1));

test('rappel d’inventaire : le lundi matin, selon la fréquence', () => {
  assert.equal(rappelDu('semaine', lundi(9, 8), null), true);
  assert.equal(rappelDu('semaine', lundi(9, 7), null), false, 'avant 8 h');
  assert.equal(rappelDu('semaine', new Date(Date.UTC(2026, 10, 10, 9)), null), false, 'mardi');
  assert.equal(rappelDu('aucune', lundi(9, 9), null), false);
  assert.equal(rappelDu('semaine', lundi(9, 10), lundi(9, 8)), false, 'déjà parti ce lundi');
  assert.equal(rappelDu('semaine', lundi(16, 8), lundi(9, 8)), true);
  assert.equal(rappelDu('2semaines', lundi(16, 8), lundi(9, 8)), false, 'une semaine sur deux');
  assert.equal(rappelDu('2semaines', lundi(23, 8), lundi(9, 8)), true);
  assert.equal(rappelDu('mois', lundi(2, 8), null), true, 'premier lundi du mois');
  assert.equal(rappelDu('mois', lundi(9, 8), null), false);
  const t = texteRappelInventaire('Lola', 'Marie', 'https://x/admin/lola/inventaire');
  assert.match(t.sujet, /faites votre inventaire de vin/);
  assert.match(t.texte, /Bonjour Marie,[\s\S]*https:\/\/x\/admin\/lola\/inventaire/);
});

test('tableau de bord : l’inventaire est à refaire selon la fréquence', () => {
  const il = (j: number) => new Date(Date.now() - j * 864e5 - 3600e3);
  assert.equal(inventaireARefaire(il(10)), true);
  assert.equal(inventaireARefaire(il(10), '2semaines'), false);
  assert.equal(inventaireARefaire(il(20), 'mois'), false);
  assert.equal(inventaireARefaire(il(32), 'mois'), true);
});
