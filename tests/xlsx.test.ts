import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererXlsx } from '../src/lib/xlsx-simple';

test('le classeur Excel est une archive ZIP avec la feuille, les textes échappés et les montants', () => {
  const x = Buffer.from(genererXlsx('Stocks', [{ titre: 'Vin' }, { titre: 'Prix' }, { titre: 'Stock' }],
    [['Côte-Rôtie « <Œnologue> » & Co', { euros: 12.5 }, 6], ['Sans prix', { euros: null }, null]]));
  assert.equal(x.readUInt32LE(0), 0x04034b50); // en-tête ZIP
  assert.equal(x.readUInt32LE(x.length - 22), 0x06054b50); // fin du répertoire central
  const texte = x.toString('utf8');
  assert.match(texte, /\[Content_Types\]\.xml/);
  assert.match(texte, /Côte-Rôtie « &lt;Œnologue&gt; » &amp; Co/);
  assert.match(texte, /<c r="B2" s="2"><v>12.5<\/v><\/c>/);
  assert.match(texte, /<c r="C2"><v>6<\/v><\/c>/);
  assert.doesNotMatch(texte, /r="B3"/); // cellule vide : absente
});
