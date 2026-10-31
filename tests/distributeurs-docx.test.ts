import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { lireDocx } from '../src/lib/distributeurs/sources';

/** Document Word comme une copie du site Licata collée dans Word : image, référence, prix, intitulé. */
export async function docxLicata() {
  const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  const image = (rel: string, attr = 'r:embed') => `<w:p><w:r><w:drawing><a:blip ${attr}="${rel}"/></w:drawing></w:r></w:p>`;
  const corps = [image('rId5'), p('SPFER200'), p(''), p('€ 28.90'), p('€ 26.01'), p('FERRARI MAXIMUM BRUT 0,75'), p(''),
    image('rId6', 'r:link'), p('SPBIS14025'), p('€ 16.50'), p('€ 14.85'), p('PROSECCO CREDE 2025 BISOL 0,75'), p(''),
    p('SPGAT10418'), p('€ 0.00'), p('QUATTROCENTO EXTRA BRUT NICOLA GATTA 1.5L')].join('');
  const zip = new JSZip();
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="w" xmlns:r="r" xmlns:a="a"><w:body>${corps}</w:body></w:document>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0"?><Relationships>
    <Relationship Id="rId5" Type="image" Target="media/image1.png"/>
    <Relationship Id="rId6" Type="image" Target="https://shop.app4sales.net/img/SPBIS14025.jpg?v=2&amp;s=1" TargetMode="External"/></Relationships>`);
  zip.file('word/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
  return zip.generateAsync({ type: 'uint8array' });
}

test('tarifs Word : texte par paragraphes, images reliées aux références', async () => {
  const { texte, images } = await lireDocx(await docxLicata());
  assert.match(texte, /^SPFER200\n\n€ 28\.90\n€ 26\.01\nFERRARI MAXIMUM BRUT 0,75\n\nSPBIS14025/);
  const ferrari = images.get('SPFER200');
  assert.ok(ferrari && 'octets' in ferrari && ferrari.type === 'image/png' && ferrari.octets.length === 7);
  assert.deepEqual(images.get('SPBIS14025'), { url: 'https://shop.app4sales.net/img/SPBIS14025.jpg?v=2&s=1' });
  assert.equal(images.has('SPGAT10418'), false);
});
