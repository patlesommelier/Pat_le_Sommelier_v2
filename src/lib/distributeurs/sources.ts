// Sources d'un tarif de distributeur, lues sans IA quand c'est possible :
// - PDF : son texte, page par page, lignes reconstituées (un PDF scanné n'en a pas) ;
// - Excel ou CSV, et réponse d'une API (JSON, CSV ou Excel) : un tableau, dont les colonnes sont reconnues par leur titre.
// Sans « server-only » : fonctions testées.
import ExcelJS from 'exceljs';
import { vinTarif, type VinTarif } from './tarif';

// ───────── PDF ─────────
/** Texte de chaque page : les morceaux d'une même ligne sont réunis (séparés par une tabulation), de haut en bas. */
export async function textePdf(octets: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(octets));
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const contenu = await (await pdf.getPage(n)).getTextContent();
    const lignes = new Map<number, Array<[number, string]>>();
    for (const it of contenu.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 2) * 2; // même ligne à un point près
      lignes.set(y, [...(lignes.get(y) ?? []), [it.transform[4], it.str.trim()]]);
    }
    pages.push([...lignes.entries()].sort((a, b) => b[0] - a[0]).map(([, l]) => l.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('\t')).join('\n'));
  }
  return pages;
}

/** PDF sans texte (scanné, ou fait d'images) : il faudra le faire lire comme une image. */
export const pdfSansTexte = (pages: string[]) => pages.join('').replace(/\s/g, '').length < 100 * Math.max(1, Math.min(pages.length, 3));

// ───────── Tableurs ─────────
export type Tableau = string[][];

const cellule = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return String(v.getFullYear());
    if ('result' in v) return cellule(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String(v.text);
    return '';
  }
  return String(v).trim();
};

/** Toutes les feuilles d'un classeur Excel (.xlsx), lignes vides retirées. */
export async function tableauExcel(octets: Uint8Array): Promise<Tableau> {
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(Buffer.from(octets) as unknown as ArrayBuffer);
  const lignes: Tableau = [];
  classeur.eachSheet((feuille) => {
    feuille.eachRow({ includeEmpty: false }, (rang) => {
      const valeurs = (rang.values as ExcelJS.CellValue[]).slice(1).map(cellule);
      if (valeurs.some(Boolean)) lignes.push(valeurs);
    });
  });
  return lignes;
}

/** CSV (séparateur ; , ou tabulation, guillemets gérés). */
export function tableauCsv(texte: string): Tableau {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', '\t', ','].sort((a, b) => premiere.split(b).length - premiere.split(a).length)[0];
  const lignes: Tableau = [];
  let ligne: string[] = [], champ = '', guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') guillemets = false; else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ.trim()); champ = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(champ.trim()); champ = '';
      if (ligne.some(Boolean)) lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  ligne.push(champ.trim());
  if (ligne.some(Boolean)) lignes.push(ligne);
  return lignes;
}

/** Réponse JSON d'une API : la première liste d'objets trouvée devient un tableau (titres = clés). */
export function tableauJson(donnees: unknown): Tableau | null {
  const liste = (v: unknown, profondeur = 0): Record<string, unknown>[] | null => {
    if (Array.isArray(v)) return v.length && v.every((x) => x && typeof x === 'object' && !Array.isArray(x)) ? v as Record<string, unknown>[] : null;
    if (v && typeof v === 'object' && profondeur < 3) for (const x of Object.values(v)) { const l = liste(x, profondeur + 1); if (l) return l; }
    return null;
  };
  const objets = liste(donnees);
  if (!objets) return null;
  const aplatir = (o: Record<string, unknown>, prefixe = ''): Record<string, string> => Object.fromEntries(Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(aplatir(v as Record<string, unknown>, `${prefixe}${k} `)) : [[`${prefixe}${k}`, v == null ? '' : String(v)]]));
  const plats = objets.map((o) => aplatir(o));
  const titres = [...new Set(plats.flatMap((o) => Object.keys(o)))];
  return [titres, ...plats.map((o) => titres.map((t) => o[t] ?? ''))];
}

// ───────── Colonnes reconnues ─────────
type Champ = 'producteur' | 'vin' | 'appellation' | 'cuvee' | 'millesime' | 'contenance' | 'prix' | 'couleur' | 'dispo' | 'max' | 'section' | 'certification';
const TITRES: Array<[Champ, RegExp]> = [
  ['prix', /\b(prix|price|tarif|htva|hors\s*tva|net|pu|p\.u\.|unit)/],
  ['producteur', /\b(producteur|producer|domaine|chateau|maison|estate|winery|fournisseur|vigneron|marque|brand)/],
  ['millesime', /\b(millesime|vintage|annee|year|mill)\b/],
  ['contenance', /\b(contenance|format|volume|taille|size|cl|centil|bouteille)\b/],
  ['appellation', /\b(appellation|aoc|aop|region|denomination)/],
  ['cuvee', /\b(cuvee|cuvée)\b/],
  ['vin', /\b(vin|wine|libelle|designation|description|produit|product|article|nom|name|intitule)\b/],
  ['couleur', /\b(couleur|colou?r|type)\b/],
  ['dispo', /\b(dispo|disponib|stock|statut|status|availability)/],
  ['max', /\b(max|quantite max|limite)\b/],
  ['section', /\b(categorie|category|pays|country|section|famille)\b/],
  ['certification', /\b(bio|label|certif|organic)\b/],
];
const normaliser = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Ligne de titres (dans les 15 premières) et colonne de chaque champ ; null s'il manque le nom du vin ou le prix. */
export function colonnes(t: Tableau): { ligne: number; champs: Partial<Record<Champ, number>> } | null {
  for (let i = 0; i < Math.min(t.length, 15); i++) {
    const champs: Partial<Record<Champ, number>> = {};
    t[i].forEach((titre, j) => {
      const n = normaliser(titre);
      if (!n || n.length > 40) return;
      const trouve = TITRES.find(([c, re]) => champs[c] === undefined && re.test(n));
      if (trouve) champs[trouve[0]] = j;
    });
    if ((champs.vin !== undefined || champs.appellation !== undefined || champs.cuvee !== undefined) && champs.prix !== undefined) return { ligne: i, champs };
  }
  return null;
}

/** Vins d'un tableau dont les colonnes sont reconnues (sans IA) ; null si elles ne le sont pas. */
export function vinsDuTableau(t: Tableau): VinTarif[] | null {
  const c = colonnes(t);
  if (!c) return null;
  const val = (l: string[], k: Champ) => (c.champs[k] !== undefined ? l[c.champs[k]!] ?? '' : '');
  const vins: VinTarif[] = [];
  for (const l of t.slice(c.ligne + 1)) {
    let nom = [val(l, 'appellation'), val(l, 'cuvee'), val(l, 'vin')].filter(Boolean).join(' ').trim();
    let millesime = val(l, 'millesime').match(/\b(19|20)\d{2}\b/)?.[0] ?? null;
    // Millésime écrit dans le nom : « 2023 Chablis » ou « Chablis 2023 ».
    const dansNom = nom.match(/(?:^|\s)((?:19|20)\d{2})(?=\s|$)/);
    if (dansNom) { millesime ??= dansNom[1]; nom = nom.replace(dansNom[0], ' ').replace(/\s+/g, ' ').trim(); }
    const contenance = val(l, 'contenance') || nom.match(/\b\d+(?:[.,]\d+)?\s?cl\b/i)?.[0] || null;
    if (contenance && !val(l, 'contenance')) nom = nom.replace(contenance, '').replace(/\s+/g, ' ').trim();
    const dispo = normaliser(val(l, 'dispo'));
    const v = vinTarif({
      producteur: val(l, 'producteur') || null, vin: nom, millesime, contenance, prix: val(l, 'prix'), couleur: normaliser(val(l, 'couleur')) || null,
      epuise: /epuis|rupture|out of stock|indispo|^0$/.test(dispo), max: val(l, 'max') || null, section: val(l, 'section') || null,
      certification: val(l, 'certification') || null,
    });
    if (v && v.prix != null) vins.push(v);
  }
  return vins.length ? vins : null;
}

/** Tableau remis en texte (une ligne par rang, cellules séparées par des tabulations), pour le faire lire par Claude. */
export const texteDuTableau = (t: Tableau) => t.map((l) => l.join('\t')).join('\n');

// ───────── Page web collée (site du distributeur) ─────────
/** Une référence d'article : lettres puis chiffres, en majuscules (« SPFER200 », « PIBRA11 »). */
export const REFERENCE = /^[A-Z]{2,8}\d{1,8}[A-Z]?$/;

/**
 * Images d'une page web collée (version « page web » du presse-papiers), reliées à la référence d'article qui les suit :
 * sur les sites de commande, l'image d'un article vient juste avant sa référence. Adresses rendues complètes avec `base`.
 */
export function imagesParReference(html: string, base: string | null): Map<string, string> {
  const images = new Map<string, string>();
  let enAttente: string | null = null;
  const decoder = (t: string) => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>|>([^<]+)</gi)) {
    const src = m[1] ?? m[2];
    if (src) {
      if (/^data:/i.test(src) || /(logo|icon|sprite|pixel|placeholder|spacer)/i.test(src)) continue;
      try { enAttente = new URL(decoder(src), base ?? undefined).href; } catch { /* adresse illisible */ }
      continue;
    }
    const t = decoder(m[3] ?? '').trim();
    if (enAttente && REFERENCE.test(t) && !images.has(t)) { images.set(t, enAttente); enAttente = null; }
  }
  return images;
}

/** Adresse de la page d'où vient un collage (le navigateur l'indique parfois dans la version « page web »). */
export const adresseDuCollage = (html: string) => html.match(/<!--\s*SourceURL:\s*(\S+)/i)?.[1] ?? html.match(/<base\s+href="([^"]+)"/i)?.[1] ?? null;
