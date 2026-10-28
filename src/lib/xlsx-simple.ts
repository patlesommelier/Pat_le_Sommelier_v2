// Classeur Excel (.xlsx) minimal, sans dépendance : une feuille, une ligne d'en-tête en gras, des textes et des nombres
// (montants en euros au format « 12,50 € »). Le fichier est une archive ZIP (sans compression) de quelques fichiers XML.

export type Cellule = string | number | null | { euros: number | null };
export interface Colonne { titre: string; largeur?: number }

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** Nom de colonne Excel : 0 → A, 25 → Z, 26 → AA. */
const lettre = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : lettre(Math.floor(i / 26) - 1) + lettre(i % 26));

function feuille(colonnes: Colonne[], lignes: Cellule[][]) {
  const cellule = (c: Cellule, ref: string, entete = false) => {
    if (c === null || (typeof c === 'object' && c.euros === null)) return '';
    if (typeof c === 'object') return `<c r="${ref}" s="2"><v>${c.euros}</v></c>`;
    if (typeof c === 'number') return Number.isFinite(c) ? `<c r="${ref}"><v>${c}</v></c>` : '';
    return `<c r="${ref}" t="inlineStr"${entete ? ' s="1"' : ''}><is><t xml:space="preserve">${echapper(c)}</t></is></c>`;
  };
  const rangs = [colonnes.map((c) => c.titre), ...lignes].map((l, i) =>
    `<row r="${i + 1}">${l.map((c, j) => cellule(c, `${lettre(j)}${i + 1}`, i === 0)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${colonnes.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largeur ?? 14}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rangs}</sheetData>${lignes.length ? `<autoFilter ref="A1:${lettre(colonnes.length - 1)}${lignes.length + 1}"/>` : ''}</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// ───────── ZIP (méthode « stocké », sans compression) ─────────
const TABLE_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (o: Uint8Array) => { let c = 0xffffffff; for (const b of o) c = TABLE_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(fichiers: { nom: string; contenu: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const parties: Uint8Array[] = [], central: Uint8Array[] = [];
  let decalage = 0;
  for (const f of fichiers) {
    const nom = enc.encode(f.nom), donnees = enc.encode(f.contenu), crc = crc32(donnees);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // UTF-8
    local.setUint32(14, crc, true); local.setUint32(18, donnees.length, true); local.setUint32(22, donnees.length, true); local.setUint16(26, nom.length, true);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, donnees.length, true); cd.setUint32(24, donnees.length, true); cd.setUint16(28, nom.length, true); cd.setUint32(42, decalage, true);
    parties.push(new Uint8Array(local.buffer), nom, donnees);
    central.push(new Uint8Array(cd.buffer), nom);
    decalage += 30 + nom.length + donnees.length;
  }
  const tailleCentral = central.reduce((n, p) => n + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true); fin.setUint32(16, decalage, true);
  const tout = [...parties, ...central, new Uint8Array(fin.buffer)];
  const sortie = new Uint8Array(tout.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of tout) { sortie.set(p, i); i += p.length; }
  return sortie;
}

/** Le fichier .xlsx : une feuille nommée `nomFeuille`. */
export function genererXlsx(nomFeuille: string, colonnes: Colonne[], lignes: Cellule[][]): Uint8Array {
  const nom = echapper(nomFeuille.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31));
  return zip([
    { nom: '[Content_Types].xml', contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nom: '_rels/.rels', contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nom: 'xl/workbook.xml', contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nom}" sheetId="1" r:id="rId1"/></sheets>${lignes.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${nom.replace(/'/g, "''")}'!$A$1:$${lettre(colonnes.length - 1)}$${lignes.length + 1}</definedName></definedNames>` : ''}</workbook>` },
    { nom: 'xl/_rels/workbook.xml.rels', contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nom: 'xl/styles.xml', contenu: STYLES },
    { nom: 'xl/worksheets/sheet1.xml', contenu: feuille(colonnes, lignes) },
  ]);
}
