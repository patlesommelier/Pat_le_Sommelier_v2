import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeDImage } from '../src/lib/distributeurs/etiquettes';

test('type d’une image reconnu à ses premiers octets (images envoyées en « octet-stream »)', () => {
  const avec = (debut: number[] | string, n = 16) => Buffer.concat([Buffer.from(debut as never), Buffer.alloc(n)]);
  assert.equal(typeDImage(avec([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(typeDImage(avec([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(typeDImage(avec('GIF89a')), 'image/gif');
  assert.equal(typeDImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)])), 'image/webp');
  assert.equal(typeDImage(avec('<html><body>')), null);
});
