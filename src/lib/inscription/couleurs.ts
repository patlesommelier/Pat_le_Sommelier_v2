// Pat le sommelier — couleurs proposées à partir du logo (fonctions pures, testables).
//
// L'app client pose le logo (clair) et du texte blanc sur la couleur du restaurant :
// une couleur n'est proposée que si le blanc y reste lisible (contraste ≥ 4,5:1, WCAG AA).

export type Rgb = [number, number, number];

export const hex = ([r, g, b]: Rgb) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

export function depuisHex(h: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: Rgb) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export const contrasteAvecBlanc = (c: Rgb) => 1.05 / (luminance(c) + 0.05);
export const lisibleAvecBlanc = (c: Rgb) => contrasteAvecBlanc(c) >= 4.5;

function versHsl([r, g, b]: Rgb): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function depuisHsl(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Assombrit progressivement une couleur jusqu'à ce que le blanc y soit lisible. */
export function rendreLisible(c: Rgb): Rgb {
  const [h, s, l0] = versHsl(c);
  for (let l = l0; l >= 0.05; l -= 0.02) {
    const essai = depuisHsl(h, s, l);
    if (lisibleAvecBlanc(essai)) return essai;
  }
  return [36, 21, 26];
}

/**
 * Couleurs dominantes d'une image (pixels RGBA), en ignorant le transparent, le quasi-blanc
 * et le quasi-noir. Quantification par seaux de 32 niveaux par canal.
 */
export function couleursDominantes(rgba: Uint8Array | Buffer, max = 4): Rgb[] {
  const seaux = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < rgba.length; i += 4) {
    const [r, g, b, a] = [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
    if (a < 128) continue;
    const [, s, l] = versHsl([r, g, b]);
    if (l > 0.92 || l < 0.08 || s < 0.12) continue;
    const cle = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = seaux.get(cle) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    seaux.set(cle, e);
  }
  return [...seaux.values()].sort((a, b) => b.n - a.n).slice(0, max)
    .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n] as Rgb);
}

const PALETTE_SECOURS: Array<[string, string]> = [
  ['#610420', 'Bordeaux'], ['#2F5D50', 'Vert sapin'], ['#1F3A5F', 'Bleu nuit'], ['#8A5A2B', 'Caramel'], ['#3A3A3A', 'Graphite'],
];

/**
 * Propositions affichées à l'étape « Couleur » : d'abord celles du logo (rendues lisibles),
 * puis des couleurs sûres pour compléter jusqu'à 5. Un logo blanc ou sans couleur donne la palette de secours.
 */
export function couleursProposees(rgba: Uint8Array | Buffer): Array<{ hex: string; nom: string; duLogo: boolean }> {
  const out: Array<{ hex: string; nom: string; duLogo: boolean }> = [];
  for (const c of couleursDominantes(rgba)) {
    const h = hex(rendreLisible(c));
    if (!out.some((x) => x.hex === h)) out.push({ hex: h, nom: out.length ? 'Du logo' : 'Votre couleur', duLogo: true });
  }
  for (const [h, nom] of PALETTE_SECOURS) {
    if (out.length >= 5) break;
    if (!out.some((x) => x.hex === h)) out.push({ hex: h, nom, duLogo: false });
  }
  return out.slice(0, 5);
}
