import ExcelJS from 'exceljs';

/** Lit une feuille Excel et renvoie ses lignes sous forme de tableaux de valeurs (texte, nombre ou null). */
export async function lireFeuille(fichier: string, feuille: string): Promise<(string | number | null)[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fichier);
  const ws = wb.getWorksheet(feuille);
  if (!ws) throw new Error(`Feuille « ${feuille} » introuvable dans ${fichier}`);
  const lignes: (string | number | null)[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: (string | number | null)[] = [];
    for (let c = 1; c <= ws.columnCount; c++) vals.push(valeurCellule(row.getCell(c).value));
    lignes.push(vals);
  });
  return lignes;
}

function valeurCellule(v: ExcelJS.CellValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v.trim() === '' ? null : v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return valeurCellule(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text);
  }
  return String(v);
}

/** Transforme un tableau de lignes (1re ligne = en-têtes) en objets indexés par en-tête. */
export function enObjets(lignes: (string | number | null)[][]): Record<string, string | number | null>[] {
  const [entetes, ...reste] = lignes;
  return reste.map((l) => Object.fromEntries(entetes.map((h, i) => [String(h ?? `col${i}`).trim(), l[i] ?? null])));
}

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Forme de comparaison : sans accents, minuscules, sans mots génériques. */
export function cle(s: string): string {
  return slug(s)
    .replace(/\b(domaine|chateau|maison|cave|des|du|de|la|le|les|et|fils|aoc|doc|docg)\b/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function liste(v: unknown, sep: RegExp = /\s*[,;|]\s*/): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v).split(sep).map((x) => x.trim()).filter(Boolean);
}

export function entier(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export function texte(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' || s === 'None' ? null : s;
}

/** Garantit des identifiants uniques en suffixant les doublons (-2, -3…). */
export function uniques() {
  const vus = new Set<string>();
  return (id: string) => {
    let c = id, i = 2;
    while (vus.has(c)) c = `${id}-${i++}`;
    vus.add(c);
    return c;
  };
}

/** Clé courte de région utilisée dans les identifiants. */
export function cleRegion(region: string | null | undefined): string {
  const r = cle(region ?? '');
  if (r.includes('rhone')) return 'rhone';
  if (r.includes('bourgogne') || r.includes('chablis')) return 'bourgogne';
  if (r.includes('piemont') || r.includes('piemonte')) return 'piemonte';
  if (r.includes('loire')) return 'loire';
  if (r.includes('bordeaux')) return 'bordeaux';
  if (r.includes('beaujolais')) return 'beaujolais';
  if (r.includes('languedoc') || r.includes('roussillon')) return 'languedoc';
  if (r.includes('champagne')) return 'champagne';
  if (r.includes('provence')) return 'provence';
  return slug(region ?? 'autre') || 'autre';
}
