import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configStockage } from '../src/lib/stockage';

test('stockage des images : réglages Hetzner, région et adresse publique déduites', () => {
  assert.equal(configStockage({}), null);
  const c = configStockage({ STOCKAGE_S3_ENDPOINT: 'https://fsn1.your-objectstorage.com/', STOCKAGE_S3_BUCKET: 'patlesommelier-medias',
    STOCKAGE_S3_ACCESS_KEY: 'a', STOCKAGE_S3_SECRET_KEY: 'b' })!;
  assert.equal(c.endpoint, 'https://fsn1.your-objectstorage.com');
  assert.equal(c.region, 'fsn1');
  assert.equal(c.urlPublique, 'https://patlesommelier-medias.fsn1.your-objectstorage.com');
  assert.equal(configStockage({ STOCKAGE_S3_ENDPOINT: 'https://fsn1.your-objectstorage.com', STOCKAGE_S3_BUCKET: 'x', STOCKAGE_S3_ACCESS_KEY: 'a',
    STOCKAGE_S3_SECRET_KEY: 'b', STOCKAGE_URL_PUBLIQUE: 'https://images.patlesommelier.com/' })!.urlPublique, 'https://images.patlesommelier.com');
});
