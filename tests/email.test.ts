import { test } from 'node:test';
import assert from 'node:assert/strict';

test('e-mails : la réponse de Resend est expliquée', async (t) => {
  // email.ts commence par « import 'server-only' » : neutralisé pour le test.
  const Module = await import('node:module');
  const req = Module.createRequire(import.meta.url);
  req.cache[req.resolve('server-only')] = { exports: {} } as never;
  process.env.RESEND_API_KEY = 're_test'; process.env.EMAIL_EXPEDITEUR = 'Pat le sommelier <bonjour@quidvinum.com>';
  const { envoyerEmail } = await import('../src/lib/email');
  const avant = globalThis.fetch;
  t.after(() => { globalThis.fetch = avant; });
  const reponse = (statut: number, message: string) => { globalThis.fetch = (async () => new Response(JSON.stringify({ statusCode: statut, message }), { status: statut })) as typeof fetch; };
  const e = { a: 'pat@test.be', sujet: 's', texte: 't' };
  reponse(403, 'The quidvinum.com domain is not verified. Please, add and verify your domain on https://resend.com/domains');
  assert.match((await envoyerEmail(e))!, /pas encore « Verified » chez Resend.*Resend a répondu 403/);
  reponse(401, 'API key is invalid');
  assert.match((await envoyerEmail(e))!, /RESEND_API_KEY est refusée/);
  reponse(422, 'Invalid `from` field.');
  assert.match((await envoyerEmail(e))!, /EMAIL_EXPEDITEUR est mal écrite/);
  globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch;
  assert.equal(await envoyerEmail(e), null);
});
