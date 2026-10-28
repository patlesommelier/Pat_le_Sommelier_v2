import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererBonCommande, referenceCommande } from '../src/lib/bon-commande';
import { couper, largeur } from '../src/lib/pdf-simple';

test('le bon de commande est un PDF avec les vins, les accents et le total', () => {
  const pdf = Buffer.from(genererBonCommande({
    numero: 7, date: new Date('2026-10-28T10:00:00Z'),
    restaurant: { nom: 'Bistro Bercuit', adresse: 'Rue de la Loi 1, 1000 Bruxelles', tva: 'BE0123456789', email: 'cave@bercuit.be' },
    fournisseur: { nom: 'Cave Éloïse', email: 'commandes@eloise.be' },
    lignes: [{ libelle: 'Pouilly-Fumé de Ladoucette 2024', detail: 'Château du Nozet · 75 cl', quantite: 12, prix_achat: 14.5 }, { libelle: 'Côte-Rôtie (cuvée « Œnologue »)', quantite: 6 }],
  })).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.trimEnd().endsWith('%%EOF'));
  assert.match(pdf, /\(Pouilly-Fum\xe9 de Ladoucette 2024\) Tj/);
  assert.match(pdf, /\(C\xf4te-R\xf4tie \\\(cuv\xe9e \xab \x8cnologue \xbb\\\)\) Tj/); // parenthèses échappées, Œ en WinAnsi
  assert.match(pdf, /\(18 bouteilles\)/);
  assert.match(pdf, /Total HTVA : 174,00/); // 12 × 14,50 € ; la ligne sans prix ne compte pas
  // Table des références : chaque objet à la position annoncée.
  const xref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
  const positions = pdf.slice(xref).split('\n').slice(3).filter((l) => / 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
  positions.forEach((p, i) => assert.ok(pdf.startsWith(`${i + 1} 0 obj`, p), `objet ${i + 1}`));
  assert.equal(referenceCommande({ numero: 7, date: new Date('2026-10-28') }), '2026-007');
});

test('les lignes trop longues sont coupées à la largeur', () => {
  const lignes = couper('Un très long nom de vin qui ne tient pas sur une seule ligne du bon de commande', 150, 10);
  assert.ok(lignes.length > 1);
  lignes.forEach((l) => assert.ok(largeur(l, 10) <= 150));
});
