import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { refusPassager } from '../src/lib/generation/file';

test('403 sans message : passager ; 403 avec message, 400 : non', () => {
  const sansCorps = Anthropic.APIError.generate(403, undefined, undefined, new Headers() as never);
  assert.match(sansCorps.message, /no body/);
  assert.equal(refusPassager(sansCorps), true);
  const avecCorps = Anthropic.APIError.generate(403, { type: 'error', error: { type: 'permission_error', message: 'region not supported' } }, undefined, new Headers() as never);
  assert.equal(refusPassager(avecCorps), false);
  assert.equal(refusPassager(Anthropic.APIError.generate(400, undefined, undefined, new Headers() as never)), false);
});
