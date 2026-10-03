const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };

/** Contraste du blanc sur une couleur (#RRGGBB). */
export function contrasteBlanc(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return 21;
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (l + 0.05);
}

/** Couleur claire : sous 3:1, le blanc n'est plus lisible dessus (l'app écrit alors en foncé). */
export const couleurClaire = (hex: string) => contrasteBlanc(hex) < 3;
