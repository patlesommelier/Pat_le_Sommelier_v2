import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { contrasteAvecBlanc, depuisHex, lisibleAvecBlanc, couleursProposees, rendreLisible, hex } from '../src/lib/inscription/couleurs';
import { couleursDuLogo, logoEstClair } from '../src/lib/inscription/couleurs-image';

const image = (fond: string, motif?: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">${fond === 'transparent' ? '' : `<rect width="200" height="100" fill="${fond}"/>`}${motif ? `<circle cx="100" cy="50" r="40" fill="${motif}"/>` : ''}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

test('le rouge de Lola est lisible avec du texte blanc', () => {
  assert.ok(lisibleAvecBlanc(depuisHex('#BA4037')!));
  assert.ok(contrasteAvecBlanc(depuisHex('#BA4037')!) > 4.5);
});

test('une couleur trop claire est assombrie jusqu’à être lisible', () => {
  const jaune = depuisHex('#F2C94C')!;
  assert.equal(lisibleAvecBlanc(jaune), false);
  assert.ok(lisibleAvecBlanc(rendreLisible(jaune)));
});

test('logo rouge : la première proposition vient du logo', async () => {
  const p = await couleursDuLogo(await image('transparent', '#BA4037'));
  assert.equal(p[0].duLogo, true);
  assert.ok(lisibleAvecBlanc(depuisHex(p[0].hex)!));
  assert.equal(p.length, 5);
});

test('logo blanc (comme celui de Lola) : palette de secours, et logo détecté comme clair', async () => {
  const blanc = await image('transparent', '#FFFFFF');
  const p = await couleursDuLogo(blanc);
  assert.ok(p.every((x) => !x.duLogo));
  assert.equal(await logoEstClair(blanc), true);
  assert.equal(await logoEstClair(await image('transparent', '#24151A')), false);
});

test('hex et depuisHex sont réciproques', () => {
  assert.equal(hex(depuisHex('#610420')!), '#610420');
  assert.equal(depuisHex('rouge'), null);
  assert.equal(couleursProposees(new Uint8Array()).length, 5);
});
