// Format des principes : lecture des vrais fichiers de Pat (V5 en service, V6 en brouillon), validation, différences, export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { differences, lireExcel, lireJson, valider, versExcel, versJson } from '../src/lib/principes/format';

const fichier = (nom: string) => fs.readFileSync(`data/pat/${nom}`);

test('lit la V6 de Pat : 44 numéros, 2 archivés, 8 lignes à relire', async () => {
  const v6 = await lireExcel(fichier('principes_pat_V6.xlsx'));
  assert.equal(v6.principes.length, 44);
  assert.deepEqual(v6.principes.filter((p) => p.statut === 'archive').map((p) => p.n), [17, 31]);
  assert.equal(v6.principes.filter((p) => p.aRelire).length, 8);
  assert.equal(v6.questions.length, 2);
});

test('la V6 est valide, sans avertissement', async () => {
  const { erreurs, avertissements } = valider(await lireExcel(fichier('principes_pat_V6.xlsx')));
  assert.deepEqual(erreurs, []);
  assert.deepEqual(avertissements, []);
});

test('différences V5 → V6 : n°17 et 31 archivés, n°4, 6, 9, 10, 11 et 41 modifiés', async () => {
  const d = differences(await lireExcel(fichier('principes_pat_V5.xlsx')), await lireExcel(fichier('principes_pat_V6.xlsx')));
  assert.deepEqual(d.archives, [17, 31]);
  assert.deepEqual(d.modifies.map((m) => m.n), [4, 6, 9, 10, 11, 41]);
  assert.deepEqual(d.ajoutes, []);
  assert.deepEqual(d.supprimes, []);
});

test('détecte un renvoi cassé et un titre cité qui n’existe plus', async () => {
  const v = await lireExcel(fichier('principes_pat_V6.xlsx'));
  const p41 = v.principes.find((p) => p.n === 41)!;
  p41.regle = p41.regle.replace('acidité et salinité du vin', 'acidité littorale') + ' Voir n°99.';
  const { erreurs, avertissements } = valider(v);
  assert.match(erreurs.join(), /n°99/);
  assert.match(avertissements.join(), /n°9/);
});

test('refuse un fichier sans les bonnes colonnes', async () => {
  const v = await lireExcel(fichier('principes_pat_V6.xlsx'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await versExcel(v) as unknown as ArrayBuffer);
  wb.getWorksheet('Principes')!.getRow(1).getCell(4).value = 'Description';
  await assert.rejects(lireExcel(Buffer.from(await wb.xlsx.writeBuffer())), /Règle/);
});

test('export puis réimport : rien ne change (Excel et JSON)', async () => {
  const v6 = await lireExcel(fichier('principes_pat_V6.xlsx'));
  const x = await lireExcel(await versExcel({ ...v6, code: 'V6' }));
  const j = lireJson(versJson(v6));
  for (const r of [x, j]) assert.deepEqual(differences(v6, r), { ajoutes: [], supprimes: [], archives: [], modifies: [] });
  assert.equal(x.principes.filter((p) => p.aRelire).length, 8);
});
