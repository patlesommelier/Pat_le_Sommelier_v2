/**
 * Menu imprimable : chaque plat avec un vin suggéré par Pat (l'une de ses premières propositions dans l'app, varié d'un plat à
 * l'autre), dans le style de la
 * carte des vins imprimée. Deux documents : le menu (entrées, plats, desserts, fromages) et, à part, les suggestions du moment,
 * qui changent de semaine en semaine. Fonctions pures, sans dépendance.
 *
 * IMPORTANT : jamais de ranking, de note ni de score ici — seulement les noms et les prix.
 */
import { encresImpression } from './couleurs';

export interface VinSuggere { titre: string; detail: string | null; prix: string | null }
export interface PlatImprimable { nom: string; description?: string | null; prix: string | null; vin: VinSuggere | null }
export interface SectionMenu { titre: string; plats: PlatImprimable[] }
export interface OptionsMenu {
  titre: string;              // « Menu » ou « Suggestions du moment »
  format: 'A4' | 'A5';
  couleurAccent: string;
  noirEtBlanc: boolean;
  prixVin: boolean;           // prix du vin suggéré (verre, bouteille)
  rappelPat: boolean;         // « Scannez le QR code… » en bas
}

const echapper = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const couleurSure = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#680021');

function htmlPlat(p: PlatImprimable, o: OptionsMenu) {
  const v = p.vin;
  return `<div class="plat">
  <div class="plat-ligne"><span class="plat-nom">${echapper(p.nom)}</span><span class="points" aria-hidden="true"></span>${p.prix ? `<span class="plat-prix">${echapper(p.prix)}</span>` : ''}</div>
  ${p.description ? `<p class="plat-description">${echapper(p.description)}</p>` : ''}
  ${v ? `<p class="vin"><span class="vin-mot">Vin proposé</span> <span class="vin-titre">${echapper(v.titre)}</span>${v.detail ? ` <span class="vin-detail">${echapper(v.detail)}</span>` : ''}${o.prixVin && v.prix ? ` <span class="vin-prix">${echapper(v.prix)}</span>` : ''}</p>` : ''}
</div>`;
}

function css(o: OptionsMenu) {
  const accent = o.noirEtBlanc ? '#1F1A1C' : couleurSure(o.couleurAccent);
  // Texte dans la couleur des titres quand elle est foncée (bleu marine…), sinon en noir.
  const { encre, douce, discrete } = encresImpression(accent, o.noirEtBlanc);
  const a5 = o.format === 'A5';
  return `
@page { size: ${a5 ? 'A5' : 'A4'}; margin: ${a5 ? '12mm 13mm' : '16mm 19mm 14mm'}; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #FFFFFF; }
body { font-family: Lato, 'Helvetica Neue', Helvetica, sans-serif; color: ${encre}; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: ${a5 ? '10pt' : '11pt'}; }
.entete { text-align: center; margin-bottom: ${a5 ? '6mm' : '9mm'}; }
.logo { display: block; margin: 0 auto 3mm; max-height: ${a5 ? '9mm' : '12mm'}; max-width: ${a5 ? '35mm' : '45mm'}; width: auto; height: auto; object-fit: contain; mix-blend-mode: multiply; filter: brightness(1.06) contrast(1.08); /* fond blanc ou crème d’un logo carré fondu dans le papier */ }
.logo-fond { display: inline-block; margin: 0 auto 3mm; padding: 2.5mm 4mm; border-radius: 3mm; background: ${accent}; }
.logo-fond .logo { margin: 0; }
.entete-nom { font-size: 8.5pt; font-weight: 700; letter-spacing: 3.4px; text-transform: uppercase; color: ${accent}; }
.entete h1 { margin: 2mm 0 0; font: 600 ${a5 ? '30pt' : '40pt'}/1.05 'Cormorant Garamond', Garamond, serif; color: ${accent}; }
.filet { width: 15mm; height: 2px; background: ${accent}; margin: 4mm auto 0; }
.section { margin-bottom: 5mm; }
/* Entrées, Plats, Desserts : un grand titre centré entre deux filets, les plats en dessous. */
.section { break-before: auto; }
.section > h2 { display: flex; align-items: center; gap: 5mm; margin: ${a5 ? '6mm 0 4mm' : '9mm 0 6mm'}; font: 600 ${a5 ? '20pt' : '26pt'}/1.1 'Cormorant Garamond', Garamond, serif; color: ${accent}; break-after: avoid; }
.section > h2::before, .section > h2::after { content: ""; flex: 1; height: 1px; background: ${accent}; opacity: .6; }
.section:first-of-type > h2 { margin-top: 2mm; }
.plat { break-inside: avoid; margin-bottom: ${a5 ? '3.5mm' : '4.5mm'}; }
.plat-ligne { display: flex; align-items: baseline; gap: 2.6mm; }
.plat-nom { font: 600 ${a5 ? '14.5pt' : '17pt'}/1.2 'Cormorant Garamond', Garamond, serif; flex: 0 1 auto; }
.plat-description { margin: 0.8mm 0 0; font-size: ${a5 ? '8.5pt' : '9.5pt'}; line-height: 1.4; color: ${discrete}; }
.points { flex: 1; min-width: 6mm; border-bottom: 1px dotted #B9AEB2; transform: translateY(-1mm); }
.plat-prix { font-size: ${a5 ? '10.5pt' : '11.5pt'}; font-weight: 700; white-space: nowrap; }
.vin { margin: 1.2mm 0 0; font: italic 500 ${a5 ? '9pt' : '10pt'}/1.35 'Cormorant Garamond', Garamond, serif; color: ${douce}; }
.vin-mot { font: 700 6.5pt Lato, sans-serif; font-style: normal; letter-spacing: 1.6px; text-transform: uppercase; color: ${accent}; margin-right: 1mm; }
.vin-titre { font-weight: 600; }
.vin-detail { color: ${discrete}; }
.vin-prix { font: 700 7.5pt Lato, sans-serif; font-style: normal; white-space: nowrap; margin-left: 1mm; }
.fin { margin-top: 8mm; padding-top: 4mm; border-top: 1px solid #E2D8DB; text-align: center; }
.fin p { margin: 0; font: italic 500 ${a5 ? '11pt' : '13pt'}/1.35 'Cormorant Garamond', Garamond, serif; }
.vide { text-align: center; color: ${discrete}; font-style: italic; }
.centre { display: flex; flex-direction: column; }
.centre .corps { flex: 1; display: flex; flex-direction: column; justify-content: center; }
@media print { .centre { min-height: ${a5 ? '184mm' : '265mm'}; } }
@media screen {
  html { background: #EEE6E8; }
  body { padding: 24px 12px; background: #EEE6E8; }
  .pages { width: ${a5 ? '148mm' : '210mm'}; min-height: ${a5 ? '210mm' : '297mm'}; margin: 0 auto 24px; background: #FFFFFF; box-shadow: 0 1px 4px rgba(0,0,0,0.15); padding: ${a5 ? '12mm 13mm' : '16mm 19mm 14mm'}; }
}
@media print { .barre-impression { display: none !important; } }
`;
}

/**
 * Document HTML complet. `barre` : barre d'outils affichée à l'écran seulement, jamais imprimée.
 * `logo` : logo foncé (posé sur le blanc), ou logo clair (posé sur la couleur du restaurant).
 */
export function genererMenuHTML({ restaurant, logo, sections, options: o, barre = '' }:
  { restaurant: string; logo?: { url: string; clair: boolean } | null; sections: SectionMenu[]; options: OptionsMenu; barre?: string }) {
  const img = logo ? `<img class="logo" src="${echapper(logo.url)}" alt="${echapper(restaurant)}"${o.noirEtBlanc ? ' style="filter: grayscale(1)"' : ''}>` : '';
  const htmlLogo = logo ? (logo.clair ? `<span class="logo-fond">${img}</span>` : img) : '';
  const remplies = sections.filter((s) => s.plats.length);
  // Peu de plats (les suggestions de la semaine, souvent) : ils sont centrés dans la hauteur de la page, avec leur titre.
  const centre = remplies.length === 1 && remplies[0].plats.length <= 8;
  // Le titre suit les plats au milieu de la page quand ils sont centrés.
  const entete = `<header class="entete">${htmlLogo}<span class="entete-nom">${echapper(restaurant)}</span><h1>${echapper(o.titre)}</h1><div class="filet"></div></header>`;
  const corps = remplies.length
    ? remplies.map((s) => `<section class="section">${remplies.length > 1 || s.titre !== o.titre ? `<h2>${echapper(s.titre)}</h2>` : ''}
${s.plats.map((p) => htmlPlat(p, o)).join('\n')}
</section>`).join('\n')
    : `<p class="vide">${o.titre === 'Menu' ? 'Aucun plat à imprimer pour le moment.' : 'Aucune suggestion en ce moment : envoyez la photo de votre ardoise dans « Gérer le menu ».'}</p>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(restaurant)} — ${echapper(o.titre)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Lato:wght@400;700&display=swap">
<style>${css(o)}</style>
</head>
<body>
${barre}
<main class="pages${centre ? ' centre' : ''}">
  ${centre ? `<div class="corps">${entete}${corps}</div>` : `${entete}<div class="corps">${corps}</div>`}
  ${o.rappelPat ? '<div class="fin"><p>Envie d’un autre vin ? Scannez le QR code de votre table : Pat vous conseille selon votre plat.</p></div>' : ''}
</main>
</body>
</html>`;
}
