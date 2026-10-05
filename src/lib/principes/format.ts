/**
 * Format des principes de Pat (schéma 1) : lecture d'un fichier Excel ou JSON, validation,
 * différences entre versions, export au format de Pat. Module sans base de données : testable seul,
 * utilisé par le back-office (import, export) et par le script `npm run versions`.
 *
 * Fichier Excel attendu (celui que Pat édite à la main) :
 *   onglet « Principes »          : N° | Identifiant | Titre | Règle | Tags   (obligatoire)
 *   onglet « Informations »       : clé | valeur                            (facultatif)
 *   onglet « Questions pour Pat » : N° | Question | Principe concerné       (facultatif)
 *   onglet « Décisions V… »       : N° | Question | Décision de Pat | Effet (facultatif)
 * Un principe archivé (fusionné) garde son numéro : tag « archive » ou règle commençant par « Fusionné ».
 */
import ExcelJS from 'exceljs';

export const SCHEMA = 1;
const COLONNES = ['N°', 'Identifiant', 'Titre', 'Règle', 'Tags'];

export interface Principe {
  n: number;
  id: string;
  titre: string;
  regle: string;
  tags: string[];
  statut: 'actif' | 'archive';
  aRelire: boolean;
}

export interface VersionPrincipes {
  code?: string;
  schema: number;
  principes: Principe[];
  informations: Record<string, string>;
  questions: { n: string; question: string; principes: string }[];
  decisions: { n: string; question: string; decision: string; effet: string }[];
}

export interface Differences { ajoutes: number[]; supprimes: number[]; archives: number[]; modifies: { n: number; champs: string[] }[] }

export class ErreurFormat extends Error {
  constructor(public erreurs: string[]) { super(erreurs.join('\n')); }
}

const texte = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'object' && Array.isArray((v as { richText?: unknown[] }).richText)) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('');
  }
  if (typeof v === 'object' && 'result' in (v as object)) return String((v as { result?: unknown }).result ?? '');
  return String(v).trim();
};

export const estArchive = (p: { tags: string[]; regle: string }) => p.tags.includes('archive') || /^fusionné/i.test(p.regle);

function normaliserPrincipe(brut: { n: unknown; id: unknown; titre: unknown; regle: unknown; tags: unknown }, aRelire = false): Principe {
  const tags = (Array.isArray(brut.tags) ? brut.tags.map(String) : texte(brut.tags).split(',')).map((t) => t.trim()).filter(Boolean);
  const p = { n: Number(texte(brut.n)), id: texte(brut.id), titre: texte(brut.titre), regle: texte(brut.regle), tags };
  return { ...p, statut: estArchive(p) ? 'archive' : 'actif', aRelire };
}

// ─── Lecture ───────────────────────────────────────────────────────────────

export async function lireExcel(buffer: ArrayBuffer | Buffer): Promise<VersionPrincipes> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.getWorksheet('Principes');
  if (!ws) throw new ErreurFormat(['Onglet « Principes » introuvable.']);

  const entetes = COLONNES.map((_, i) => texte(ws.getRow(1).getCell(i + 1).value));
  const erreursEntetes = COLONNES.filter((c, i) => entetes[i] !== c)
    .map((c) => `Colonne attendue « ${c} » ; trouvé : ${entetes.map((e) => `« ${e} »`).join(', ')}.`);
  if (erreursEntetes.length) throw new ErreurFormat(erreursEntetes);

  const principes: Principe[] = [];
  ws.eachRow((row, i) => {
    if (i === 1 || row.getCell(1).value == null) return;
    // Lignes à relire : surlignées en jaune dans le fichier de Pat.
    const fill = row.getCell(1).fill as { fgColor?: { argb?: string } } | undefined;
    const aRelire = fill?.fgColor?.argb?.toUpperCase().endsWith('FFF2CC') ?? false;
    principes.push(normaliserPrincipe({ n: row.getCell(1).value, id: row.getCell(2).value, titre: row.getCell(3).value,
      regle: row.getCell(4).value, tags: row.getCell(5).value }, aRelire));
  });

  const lireTable = <K extends string>(nom: string | undefined, champs: K[]) => {
    const f = nom ? wb.getWorksheet(nom) : undefined;
    const out: Record<K, string>[] = [];
    f?.eachRow((row, i) => {
      if (i === 1 || row.getCell(1).value == null) return;
      out.push(Object.fromEntries(champs.map((c, k) => [c, texte(row.getCell(k + 1).value)])) as Record<K, string>);
    });
    return out;
  };

  const informations: Record<string, string> = {};
  wb.getWorksheet('Informations')?.eachRow((row) => { informations[texte(row.getCell(1).value)] = texte(row.getCell(2).value); });

  return {
    schema: SCHEMA, principes, informations,
    questions: lireTable('Questions pour Pat', ['n', 'question', 'principes']),
    decisions: lireTable(wb.worksheets.find((w) => /^Décisions/.test(w.name))?.name, ['n', 'question', 'decision', 'effet']),
  };
}

export function lireJson(contenu: string | object): VersionPrincipes {
  const brut = (typeof contenu === 'string' ? JSON.parse(contenu) : contenu) as Record<string, unknown> | unknown[];
  const liste = Array.isArray(brut) ? brut : (brut as { principes?: unknown }).principes;
  if (!Array.isArray(liste)) throw new ErreurFormat(['JSON : tableau « principes » introuvable.']);
  const b = Array.isArray(brut) ? {} : brut as Record<string, unknown>;
  return {
    schema: SCHEMA,
    principes: liste.map((x) => {
      const p = x as Record<string, unknown>;
      return normaliserPrincipe({ n: p.n ?? p['N°'] ?? p.numero, id: p.id ?? p.identifiant, titre: p.titre, regle: p.regle ?? p['règle'], tags: p.tags }, !!p.aRelire);
    }),
    informations: (b.informations as Record<string, string>) ?? {},
    questions: (b.questions as VersionPrincipes['questions']) ?? [],
    decisions: (b.decisions as VersionPrincipes['decisions']) ?? [],
  };
}

export async function lireFichier(nomFichier: string, buffer: Buffer): Promise<VersionPrincipes> {
  if (/\.xlsx$/i.test(nomFichier)) return lireExcel(buffer);
  if (/\.json$/i.test(nomFichier)) return lireJson(buffer.toString('utf8'));
  throw new ErreurFormat(['Format non pris en charge : utilisez un fichier .xlsx ou .json.']);
}

// ─── Validation ────────────────────────────────────────────────────────────

/** Une version avec des erreurs ne peut pas devenir un brouillon ; les avertissements sont à relire. */
export function valider(version: Pick<VersionPrincipes, 'principes'>): { erreurs: string[]; avertissements: string[] } {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const { principes } = version;
  if (!principes.length) erreurs.push('Aucun principe dans le fichier.');

  const vusN = new Set<number>();
  const vusId = new Set<string>();
  for (const p of principes) {
    const ou = `Principe n°${p.n || '?'}`;
    if (!Number.isInteger(p.n) || p.n < 1) erreurs.push(`${ou} : numéro invalide.`);
    if (vusN.has(p.n)) erreurs.push(`${ou} : numéro en double.`);
    vusN.add(p.n);
    if (!/^[a-z0-9àâçéèêëîïôûùüÿœ-]+$/.test(p.id)) erreurs.push(`${ou} : identifiant « ${p.id} » invalide (minuscules, chiffres et tirets).`);
    if (vusId.has(p.id)) erreurs.push(`${ou} : identifiant « ${p.id} » en double.`);
    vusId.add(p.id);
    if (!p.titre) erreurs.push(`${ou} : titre vide.`);
    if (!p.regle) erreurs.push(`${ou} : règle vide.`);
  }

  // Renvois « n°X » : doivent exister et, depuis un principe actif, ne pas viser un archivé.
  const parN = new Map(principes.map((p) => [p.n, p]));
  for (const p of principes.filter((x) => x.statut === 'actif')) {
    for (const m of p.regle.matchAll(/n°\s?(\d+)/g)) {
      const cible = parN.get(Number(m[1]));
      if (!cible) erreurs.push(`Principe n°${p.n} : renvoi vers n°${m[1]}, qui n'existe pas.`);
      else if (cible.statut === 'archive') avertissements.push(`Principe n°${p.n} : renvoi vers n°${m[1]}, archivé.`);
    }
    // Renvois par titre : « Complète « Titre » » doit citer un titre existant (forme abrégée admise).
    for (const m of p.regle.matchAll(/«\s([^«»]{8,}?)\s»/g)) {
      const cite = m[1].trim();
      const existe = principes.some((x) => x.titre === cite || x.titre.startsWith(cite));
      const ressemble = principes.find((x) => x.titre !== cite && x.titre.slice(0, 20) === cite.slice(0, 20));
      if (!existe && ressemble) avertissements.push(`Principe n°${p.n} : cite « ${cite} », titre actuel du n°${ressemble.n} : « ${ressemble.titre} ».`);
    }
  }
  return { erreurs, avertissements };
}

// ─── Différences entre deux versions ───────────────────────────────────────

export function differences(avant: Pick<VersionPrincipes, 'principes'> | null | undefined, apres: Pick<VersionPrincipes, 'principes'>): Differences {
  const a = new Map((avant?.principes ?? []).map((p) => [p.n, p]));
  const b = new Map(apres.principes.map((p) => [p.n, p]));
  const out: Differences = { ajoutes: [], supprimes: [], archives: [], modifies: [] };
  for (const [n, p] of b) {
    const old = a.get(n);
    if (!old) { out.ajoutes.push(n); continue; }
    if (old.statut === 'actif' && p.statut === 'archive') { out.archives.push(n); continue; }
    const champs = (['titre', 'regle', 'tags', 'id'] as const).filter((k) => JSON.stringify(old[k]) !== JSON.stringify(p[k]));
    if (champs.length) out.modifies.push({ n, champs: [...champs] });
  }
  for (const n of a.keys()) if (!b.has(n)) out.supprimes.push(n);
  return out;
}

// ─── Export ────────────────────────────────────────────────────────────────

export function versJson(version: VersionPrincipes): string {
  const { principes, informations, questions, decisions } = version;
  return JSON.stringify({ schema: SCHEMA, informations,
    principes: principes.map(({ n, id, titre, regle, tags }) => ({ n, id, titre, regle, tags })), questions, decisions }, null, 2);
}

/** Même présentation que le fichier de Pat : Arial, en-tête bordeaux, colonnes larges, lignes à relire en jaune. */
export async function versExcel(version: VersionPrincipes): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const entete = (ws: ExcelJS.Worksheet, valeurs: string[], largeurs: number[]) => {
    ws.addRow(valeurs);
    ws.getRow(1).eachCell((c) => {
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B1A2E' } };
    });
    largeurs.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };
  const corps = (row: ExcelJS.Row) => row.eachCell((c) => { c.font = { name: 'Arial', size: 10 }; c.alignment = { wrapText: true, vertical: 'top' }; });

  const ws = wb.addWorksheet('Principes');
  entete(ws, COLONNES, [6, 30, 38, 85, 26]);
  for (const p of version.principes) {
    const row = ws.addRow([p.n, p.id, p.titre, p.regle, p.tags.join(', ')]);
    corps(row);
    if (p.aRelire) row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; });
  }
  const wi = wb.addWorksheet('Informations');
  wi.getColumn(1).width = 22; wi.getColumn(2).width = 110;
  for (const [k, v] of Object.entries(version.informations ?? {})) corps(wi.addRow([k, v]));
  if (version.decisions?.length) {
    const wd = wb.addWorksheet(`Décisions ${version.code ?? ''}`.trim());
    entete(wd, ['N°', 'Question', 'Décision de Pat', 'Effet'], [6, 70, 40, 70]);
    for (const d of version.decisions) corps(wd.addRow([Number(d.n) || d.n, d.question, d.decision, d.effet]));
  }
  const wq = wb.addWorksheet('Questions pour Pat');
  entete(wq, ['N°', 'Question', 'Principe concerné'], [6, 100, 20]);
  for (const q of version.questions ?? []) corps(wq.addRow([Number(q.n) || q.n, q.question, q.principes]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
