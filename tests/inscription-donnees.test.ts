// Parcours d'inscription : données reconnues, fichiers, identifiant d'URL, QR code, jeton de session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { dedoublonnerPlats, dedoublonnerVins, Plat, resumeVins, validerListe, Vin, type VinRapproche } from '../src/lib/inscription/donnees';
import { verifierFichiers } from '../src/lib/inscription/fichiers';
import { empreinte, nouveauJeton } from '../src/lib/inscription/session';
import { slugRestaurant } from '../src/lib/inscription/slug';
import { qrPng, qrSvg } from '../src/lib/qr-image';

test('les lignes illisibles sont écartées et comptées ; les vins orange sont acceptés', () => {
  const r = validerListe(Vin, [
    { libelleCarte: 'Sancerre Henri Bourgeois', producteur: 'Henri Bourgeois', millesime: '2025', prix: 58, couleur: 'blanc' },
    { libelleCarte: 'Puligny-Montrachet 1er Cru Champ Gain', millesime: '2019', prix: 195, couleur: 'blanc' },
    { libelleCarte: '', couleur: 'blanc' },
    { libelleCarte: 'Vin mystère', couleur: 'violet' },
    { libelleCarte: 'Macération de Gris', couleur: 'orange', prix: 44 },
  ]);
  assert.equal(r.ok.length, 3);
  assert.equal(r.rejetes, 2);
  assert.equal(r.ok[1].producteur, null);
});

test('catégorie de plat inconnue : « plat » par défaut', () => {
  const r = validerListe(Plat, [{ nom: 'Nems', categorie: 'entree' }, { nom: 'Planche', categorie: 'Apéritif' }, { nom: 'Café' }]);
  assert.deepEqual(r.ok.map((p) => p.categorie), ['entree', 'plat', 'plat']);
});

test('une page photographiée deux fois ne crée pas de doublons', () => {
  const plats = validerListe(Plat, [{ nom: 'Filet pur, sauce morilles' }, { nom: 'Filet pur, sauce Morilles ' }, { nom: 'Nems' }]).ok;
  assert.equal(dedoublonnerPlats(plats).length, 2);
  const vins = validerListe(Vin, [
    { libelleCarte: 'Champagne Ruinart Blanc de Blancs', couleur: 'bulles', prix: 175 },
    { libelleCarte: 'Champagne Ruinart Blanc de Blancs', couleur: 'bulles', contenance: '37,5 cl', prix: 90 },
    { libelleCarte: 'Champagne Ruinart Blanc de Blancs', couleur: 'bulles', prix: 175 },
  ]).ok;
  assert.equal(dedoublonnerVins(vins).length, 2); // deux formats = deux références
});

test('résumé : vins par couleur et vins sans producteur (aucun ranking)', () => {
  const v = (libelleCarte: string, couleur: VinRapproche['couleur'], producteur: string | null): VinRapproche => ({
    libelleCarte, couleur, producteur, appellation: null, millesime: null, contenance: null, prix: null, prixVerre: null, auVerre: false,
    region: null, vinId: null, producteurStatut: 'nouveau' });
  const r = resumeVins([v('A', 'rouge', 'X'), v('B', 'rouge', null), v('C', 'bulles', 'Y')]);
  assert.equal(r.parCouleur.rouge, 2);
  assert.deepEqual(r.sansProducteur, ['B']);
  assert.ok(!/ranking|score/i.test(JSON.stringify(r)));
});

test('fichiers : le vrai format compte, pas l’extension ; SVG avec script refusé ; envoi trop lourd refusé', () => {
  const pdf = new TextEncoder().encode('%PDF-1.7 …');
  const faux = new TextEncoder().encode('MZ exécutable');
  assert.deepEqual(verifierFichiers('menu', [{ nom: 'menu.pdf', octets: pdf }]), []);
  assert.equal(verifierFichiers('menu', [{ nom: 'menu.pdf', octets: faux }]).length, 1);
  const svgPiege = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
  assert.match(verifierFichiers('logo', [{ nom: 'logo.svg', octets: svgPiege }]).join(), /code/);
  assert.equal(verifierFichiers('logo', [{ nom: 'a.png', octets: pdf }, { nom: 'b.png', octets: pdf }]).length > 0, true);
  const lourd = new Uint8Array(3 * 1024 * 1024); lourd.set([0x25, 0x50, 0x44, 0x46]);
  assert.match(verifierFichiers('carte', [{ nom: 'a.pdf', octets: lourd }, { nom: 'b.pdf', octets: lourd }]).join(), /plusieurs fois/);
});

test('identifiant d’URL du restaurant', () => {
  assert.equal(slugRestaurant('Lola', new Set()), 'lola');
  assert.equal(slugRestaurant("Happy's Kitchen Club", new Set()), 'happys-kitchen-club');
  assert.equal(slugRestaurant('Lola', new Set(['lola', 'lola-2'])), 'lola-3');
  assert.equal(slugRestaurant('Admin', new Set()), 'admin-2'); // adresse réservée de l'app
});

test('QR code : SVG pour l’écran, PNG d’au moins 1200 px vers /<restaurant>', async () => {
  assert.match(await qrSvg('https://pat.example/lola'), /<svg/);
  const meta = await sharp(await qrPng('https://pat.example/lola')).metadata();
  assert.ok((meta.width ?? 0) >= 1200);
});

test('jeton de session : seule l’empreinte est stockée', () => {
  const { jeton, empreinte: e } = nouveauJeton();
  assert.equal(empreinte(jeton), e);
  assert.notEqual(jeton, e);
});

test('le prix des plats est gardé ; un prix illisible ne fait pas perdre le plat', () => {
  const r = validerListe(Plat, [
    { nom: 'Croquettes de crevettes', prix: 15, prixVariantes: '1 pièce 15 € / 2 pièces 27 €' },
    { nom: 'Burger', prix: '18 €' },
    { nom: 'Salade' },
  ]);
  assert.equal(r.rejetes, 0);
  assert.deepEqual(r.ok.map((p) => [p.prix, p.prixVariantes]), [[15, '1 pièce 15 € / 2 pièces 27 €'], [null, undefined], [undefined, undefined]]);
});
