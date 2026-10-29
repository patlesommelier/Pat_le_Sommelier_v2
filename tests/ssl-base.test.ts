import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sslBase } from '../src/lib/ssl-base';

test('connexion chiffrée vers Supabase, en clair vers une base locale ou interne au serveur', () => {
  assert.deepEqual(sslBase('postgresql://postgres.abc:mdp@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'), { rejectUnauthorized: false });
  assert.equal(sslBase('postgres://postgres:mdp@pat-base:5432/postgres'), false); // conteneur Coolify
  assert.equal(sslBase('postgres://postgres:mdp@x8k2l3m4n5:5432/postgres'), false);
  assert.equal(sslBase('postgresql://postgres@localhost/m1?host=/tmp/pg&port=5499'), false);
  assert.equal(sslBase('postgres://u:p@db.exemple.be:5432/pat?sslmode=disable'), false);
  assert.deepEqual(sslBase(undefined), { rejectUnauthorized: false });
});
