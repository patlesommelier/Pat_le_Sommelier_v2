// PDF minimal, sans dépendance : pages A4, texte en Helvetica (normal et gras, accents français), traits et rectangles.
// Suffisant pour un bon de commande ; produit sur le serveur (Netlify n'a pas de navigateur pour imprimer en PDF).

const A4 = { l: 595.28, h: 841.89 };

// Largeurs Helvetica (millièmes de corps) des caractères 32 à 126, normal puis gras (métriques AFM standard).
const LARGEURS = [
  '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584',
  '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584',
].map((l) => l.split(',').map(Number));

// Caractères hors Latin-1 de l'encodage WinAnsi.
const WIN_ANSI: Record<string, number> = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, 'Š': 0x8a, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, 'š': 0x9a, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };

/** Texte en octets WinAnsi ; les espaces fines deviennent des espaces, l'inconnu un point d'interrogation. */
function octets(s: string): number[] {
  return [...s.replace(/[  ​]/g, ' ')].map((c) => {
    const n = c.codePointAt(0)!;
    if (WIN_ANSI[c]) return WIN_ANSI[c];
    return n >= 32 && n <= 255 && !(n >= 127 && n < 160) ? n : 63;
  });
}

/** Largeur d'un texte en points. */
export function largeur(s: string, corps: number, gras = false) {
  let total = 0;
  for (const c of s) {
    if (c === '€' || c === '–') { total += 556; continue; }
    if (c === '—') { total += 1000; continue; }
    if (c === 'œ' || c === 'Œ') { total += 944; continue; }
    const base = c.normalize('NFD')[0];
    const n = base.codePointAt(0)!;
    total += n >= 32 && n <= 126 ? LARGEURS[gras ? 1 : 0][n - 32] : 556;
  }
  return (total * corps) / 1000;
}

/** Coupe un texte en lignes d'au plus `max` points de large. */
export function couper(s: string, max: number, corps: number, gras = false): string[] {
  const lignes: string[] = [];
  for (const paragraphe of s.split('\n')) {
    let ligne = '';
    for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (ligne && largeur(essai, corps, gras) > max) { lignes.push(ligne); ligne = mot; } else ligne = essai;
    }
    lignes.push(ligne);
  }
  return lignes;
}

type Couleur = [number, number, number];
const rgb = (hex: string): Couleur => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const nb = (x: number) => (Math.round(x * 100) / 100).toString();

export interface OptionsTexte { corps?: number; gras?: boolean; couleur?: string; aligne?: 'gauche' | 'droite' | 'centre' }

/** Document en cours : on dessine page par page, coordonnées en points depuis le haut à gauche. */
export class DocumentPdf {
  readonly largeurPage = A4.l;
  readonly hauteurPage = A4.h;
  private pages: number[][] = [];
  private courante: number[] = [];

  constructor() { this.nouvellePage(); }

  nouvellePage() {
    this.courante = [];
    this.pages.push(this.courante);
  }

  private ecrire(s: string) { for (const c of s) this.courante.push(c.charCodeAt(0)); }

  texte(x: number, y: number, s: string, o: OptionsTexte = {}) {
    const corps = o.corps ?? 10;
    const l = largeur(s, corps, o.gras);
    const gx = o.aligne === 'droite' ? x - l : o.aligne === 'centre' ? x - l / 2 : x;
    const [r, g, b] = rgb(o.couleur ?? '#1F1A1C');
    this.ecrire(`BT ${nb(r)} ${nb(g)} ${nb(b)} rg /${o.gras ? 'F2' : 'F1'} ${nb(corps)} Tf ${nb(gx)} ${nb(this.hauteurPage - y)} Td (`);
    for (const o8 of octets(s)) {
      if (o8 === 0x28 || o8 === 0x29 || o8 === 0x5c) this.courante.push(0x5c);
      this.courante.push(o8);
    }
    this.ecrire(') Tj ET\n');
  }

  trait(x1: number, y1: number, x2: number, y2: number, couleur = '#D9CFD2', epaisseur = 0.75) {
    const [r, g, b] = rgb(couleur);
    this.ecrire(`${nb(r)} ${nb(g)} ${nb(b)} RG ${nb(epaisseur)} w ${nb(x1)} ${nb(this.hauteurPage - y1)} m ${nb(x2)} ${nb(this.hauteurPage - y2)} l S\n`);
  }

  rectangle(x: number, y: number, l: number, h: number, couleur: string) {
    const [r, g, b] = rgb(couleur);
    this.ecrire(`${nb(r)} ${nb(g)} ${nb(b)} rg ${nb(x)} ${nb(this.hauteurPage - y - h)} ${nb(l)} ${nb(h)} re f\n`);
  }

  /** Le fichier PDF complet. */
  octets(): Uint8Array {
    const objets: (string | number[])[] = [];
    const n = this.pages.length;
    // 1 catalogue, 2 pages, 3 et 4 polices, puis pour chaque page : la page et son contenu.
    objets.push('<< /Type /Catalog /Pages 2 0 R >>');
    objets.push(`<< /Type /Pages /Count ${n} /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] >>`);
    objets.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objets.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.pages.forEach((contenu, i) => {
      objets.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.l} ${A4.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
      objets.push([...Array.from(`<< /Length ${contenu.length} >>\nstream\n`, (c) => c.charCodeAt(0)), ...contenu, ...Array.from('\nendstream', (c) => c.charCodeAt(0))]);
    });
    const sortie: number[] = [];
    const ajouter = (s: string | number[]) => { if (typeof s === 'string') for (const c of s) sortie.push(c.charCodeAt(0)); else for (const o of s) sortie.push(o); };
    ajouter('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    const positions: number[] = [];
    objets.forEach((o, i) => { positions.push(sortie.length); ajouter(`${i + 1} 0 obj\n`); ajouter(o); ajouter('\nendobj\n'); });
    const xref = sortie.length;
    ajouter(`xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`);
    ajouter(`trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return Uint8Array.from(sortie);
  }
}
