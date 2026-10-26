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

type AvecLogos = { couleur: string; logo_url: string | null; logo_fonce_url?: string | null; logo_choix?: string | null;
  logo_ratio?: number | null; logo_fonce_ratio?: number | null };

/**
 * Logo affiché dans l'app (et sur les supports) : celui choisi dans « Apparence » ; sans choix, le foncé sur une couleur
 * claire et le clair sinon. S'il n'y a qu'un logo, c'est lui. null : aucun logo (Pat le remplace).
 */
export function logoAffiche(r: AvecLogos): { url: string; ratio: number | null } | null {
  const clair = r.logo_url ? { url: r.logo_url, ratio: r.logo_ratio ?? null } : null;
  const fonce = r.logo_fonce_url ? { url: r.logo_fonce_url, ratio: r.logo_fonce_ratio ?? null } : null;
  const prefereFonce = r.logo_choix ? r.logo_choix === 'fonce' : couleurClaire(r.couleur);
  return prefereFonce ? fonce ?? clair : clair ?? fonce;
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/**
 * Couleur dominante d'une image (pixels RGBA) : les pixels transparents, presque blancs, presque noirs ou gris sont ignorés ;
 * les autres sont regroupés par teinte, et la moyenne du groupe le plus fourni est renvoyée (#RRGGBB). null : aucune couleur franche.
 */
export function couleurDominante(rgba: Uint8Array | Buffer): string | null {
  const groupes = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const [r, g, b, a] = [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
    if (a < 128) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (l > 0.93 || l < 0.06 || s < 0.25) continue;
    const h = max === min ? 0 : max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    const cle = Math.round(h * 4) % 24; // 24 teintes, et clair / foncé à part
    const k = cle * 2 + (l < 0.45 ? 0 : 1);
    const x = groupes.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    groupes.set(k, { n: x.n + 1, r: x.r + r, g: x.g + g, b: x.b + b });
  }
  const meilleur = [...groupes.values()].sort((a, b) => b.n - a.n)[0];
  if (!meilleur || meilleur.n < 12) return null;
  return `#${hex2(meilleur.r / meilleur.n)}${hex2(meilleur.g / meilleur.n)}${hex2(meilleur.b / meilleur.n)}`.toUpperCase();
}

/** Couleur sans teinte : noir, gris ou blanc (saturation faible, ou presque noire). */
export function couleurNeutre(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return true;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max < 40 || max - min < 30;
}

/**
 * Couleur des supports imprimés (carte des vins, menu) : celle de l'app si elle se lit sur le papier blanc (bleu foncé, bordeaux…)
 * et n'est pas un noir ou un gris ; sinon (jaune, beige, noir…) la couleur du logo si elle s'y lit ; sinon celle de l'app quand même.
 */
export function couleurImpression(app: string, logo: string | null) {
  if (!couleurClaire(app) && !couleurNeutre(app)) return app;
  return logo && !couleurClaire(logo) ? logo : app;
}
