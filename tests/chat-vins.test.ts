// Discussion avec Pat : les vins cités sur la ligne technique « VINS : », avec le plat de l'accord, pour tous les formats de code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraireVins } from '../src/lib/pat-cerveau';

test('codes de Lola, de Chez Pat et d’un restaurant inscrit, avec leur plat ; la ligne technique est retirée', () => {
  const codes = ['L-B02', 'P-B03', 'bistro-bercuit-R01', 'bistro-bercuit-R10'];
  const plats = ['lola-bar-roti', 'bistro-bercuit-tartare', 'bistro-bercuit-tartare-2'];
  const r = extraireVins('Pour votre bar, voici ce que je vous propose.\nVINS : L-B02 (lola-bar-roti), P-B03, bistro-bercuit-R10 (bistro-bercuit-tartare-2), Z-Z99 (lola-bar-roti)', codes, plats);
  assert.equal(r.reponse, 'Pour votre bar, voici ce que je vous propose.');
  assert.deepEqual(r.vins, [
    { id: 'L-B02', plat: 'lola-bar-roti' },
    { id: 'P-B03', plat: null },
    { id: 'bistro-bercuit-R10', plat: 'bistro-bercuit-tartare-2' },
  ]);
  assert.deepEqual(extraireVins('Bonjour !\nVINS : aucun', codes, plats).vins, []);
});
