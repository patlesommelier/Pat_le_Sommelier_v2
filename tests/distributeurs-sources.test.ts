import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colonnes, pdfSansTexte, tableauCsv, tableauExcel, tableauJson, textePdf, vinsDuTableau } from '../src/lib/distributeurs/sources';
import { genererXlsx } from '../src/lib/xlsx-simple';
import { genererBonCommande } from '../src/lib/bon-commande';

test('sources : texte d’un PDF, ligne par ligne', async () => {
  const pdf = genererBonCommande({ numero: 7, date: new Date('2026-10-31'), restaurant: { nom: 'Lola', adresse: null, tva: null, contact: null, telephone: null, email: null },
    fournisseur: { nom: 'Quid Vinum', adresse: null, tva: null, contact: null, telephone: null, email: null },
    lignes: [{ libelle: 'Sancerre 2025', detail: 'Henri Bourgeois', quantite: 6, prix_achat: 19.8 }] });
  const pages = await textePdf(pdf);
  assert.equal(pages.length, 1);
  assert.match(pages[0], /Sancerre 2025/);
  assert.match(pages[0], /19,80/);
  assert.equal(pdfSansTexte(pages), false);
  assert.equal(pdfSansTexte(['', ' ']), true);
});

test('sources : Excel aux colonnes reconnues, lu sans IA', async () => {
  const xlsx = genererXlsx('Tarif', [{ titre: 'Domaine' }, { titre: 'Désignation' }, { titre: 'Millésime' }, { titre: 'Format' }, { titre: 'Prix HTVA' }, { titre: 'Stock' }], [
    ['Domaine Clotilde Davenne', 'Chablis', 2024, '75 cl', { euros: 18.22 }, 'OK'],
    ['Domaine Clotilde Davenne', 'Chablis', 2020, '150 cl', { euros: 33.19 }, 'OK'],
    ['Domaine Gabin & Félix Richoux', 'Irancy "les Cailles"', 2021, '75 cl', { euros: 25.24 }, 'Épuisé'],
    ['', '', null, null, null, null],
  ]);
  const t = await tableauExcel(xlsx);
  assert.deepEqual(colonnes(t)?.champs, { producteur: 0, vin: 1, millesime: 2, contenance: 3, prix: 4, dispo: 5 });
  const vins = vinsDuTableau(t)!;
  assert.equal(vins.length, 3);
  assert.deepEqual([vins[0].producteur, vins[0].libelle, vins[0].millesime, vins[0].contenance, vins[0].prix], ['Domaine Clotilde Davenne', 'Chablis', '2024', null, 18.22]);
  assert.equal(vins[1].contenance, '150 cl');
  assert.equal(vins[2].epuise, true);
});

test('sources : CSV, millésime et contenance écrits dans le nom', () => {
  const t = tableauCsv('Produit;Prix\n"2023 Chablis 37,5cl";11,28\n2024 Saint-Bris;11.72\n');
  const vins = vinsDuTableau(t)!;
  assert.deepEqual(vins.map((v) => [v.libelle, v.millesime, v.contenance, v.prix]), [['Chablis', '2023', '37,5 cl', 11.28], ['Saint-Bris', '2024', null, 11.72]]);
  assert.equal(vinsDuTableau(tableauCsv('a,b\n1,2')), null); // colonnes inconnues : ce sera Claude
});

test('sources : réponse JSON d’une API', () => {
  const t = tableauJson({ data: { items: [{ name: 'Vouvray sec', vintage: 2024, price: 14.39, producer: { name: 'Vincent Carême' } }] } })!;
  const vins = vinsDuTableau(t)!;
  assert.deepEqual([vins[0].libelle, vins[0].millesime, vins[0].prix, vins[0].producteur], ['Vouvray sec', '2024', 14.39, 'Vincent Carême']);
  assert.equal(tableauJson({ ok: true }), null);
});

test('sources : images d’une page web collée, reliées à leur référence d’article', async () => {
  const { imagesParReference, adresseDuCollage } = await import('../src/lib/distributeurs/sources');
  const html = `<!-- SourceURL: https://shop.app4sales.net/licata/ -->
    <div class="article"><img src="/img/logo.png"><img src="images/SPFER200.jpg?x=1&amp;y=2"><span>SPFER200</span><span>€ 28.90</span></div>
    <div class="article"><img src='https://cdn.exemple.be/b.png'><b>PIBRA11</b></div>
    <div class="article"><span>SPGAT10418</span></div>`;
  const imgs = imagesParReference(html, adresseDuCollage(html));
  assert.equal(imgs.get('SPFER200'), 'https://shop.app4sales.net/licata/images/SPFER200.jpg?x=1&y=2');
  assert.equal(imgs.get('PIBRA11'), 'https://cdn.exemple.be/b.png');
  assert.equal(imgs.has('SPGAT10418'), false); // pas d'image juste avant
});
