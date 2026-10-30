import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empreinteJeton, hacherMotDePasse, nouveauJeton, verifierMotDePasse } from '../src/lib/comptes/secret';

test('comptes : mot de passe haché avec un sel, vérifié sans erreur', async () => {
  const a = await hacherMotDePasse('un mot de passe solide');
  const b = await hacherMotDePasse('un mot de passe solide');
  assert.match(a, /^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
  assert.notEqual(a, b); // sel différent
  assert.equal(await verifierMotDePasse('un mot de passe solide', a), true);
  assert.equal(await verifierMotDePasse('un mot de passe solidE', a), false);
  assert.equal(await verifierMotDePasse('x', null), false);
  assert.equal(await verifierMotDePasse('x', 'n’importe quoi'), false);
});

test('comptes : jetons aléatoires, seule leur empreinte est gardée', () => {
  const j = nouveauJeton();
  assert.match(j, /^[\w-]{43}$/);
  assert.notEqual(j, nouveauJeton());
  assert.match(empreinteJeton(j), /^[0-9a-f]{64}$/);
  assert.equal(empreinteJeton(j), empreinteJeton(j));
});
