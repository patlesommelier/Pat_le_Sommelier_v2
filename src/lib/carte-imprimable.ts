/**
 * Carte des vins imprimable : document HTML complet (couverture, couleurs, régions, présentation de chaque vin par Pat), prêt à imprimer
 * depuis le navigateur ou à enregistrer en PDF. Fonctions pures, sans dépendance.
 *
 * IMPORTANT : ne jamais transmettre ici les rankings, notes ou scores. Ce module ne lit que les champs de VinImprimable.
 */

export type CouleurCarte = 'bulles' | 'blanc' | 'rose' | 'rouge' | 'orange' | 'doux';

export interface VinImprimable {
  id: string;
  nom: string;
  producteur: string | null;
  millesime: string | null;
  contenance: string | null;     // « 37,5 cl », ou null pour la bouteille
  couleur: CouleurCarte;
  region: string | null;         // « Bourgogne », ou null (bulles, rosés…)
  prix: number | null;           // bouteille
  prixVerre: number | null;      // au verre
  presentation: string | null;       // présentation de 3 à 4 lignes générée par Pat
  presentationPerso: string | null;  // présentation corrigée par le restaurant (prioritaire)
  visible: boolean;              // false = indisponible : absent de la carte
}

export interface RestaurantImprimable {
  nom: string;
  logoUrl?: string | null;       // logo clair, posé sur la couleur du restaurant
  logoSombreUrl?: string | null; // logo foncé, pour le noir et blanc
  qrCodeUrl?: string | null;     // image du QR code (URL ou data:)
  patLogoUrl?: string | null;    // petit logo de Pat le sommelier, en bas à gauche de chaque page
}

export interface OptionsCarte {
  format: 'A4' | 'A5';
  couleurAccent: string;
  noirEtBlanc: boolean;
  ordre: 'app' | 'prix';        // 'app' : couleur puis région, ordre de la carte | 'prix' : couleur puis prix croissant
  afficherPresentation: boolean;
  afficherProducteur: boolean;
  couverture: boolean;
  rappelPat: boolean;
}

export const OPTIONS_PAR_DEFAUT: OptionsCarte = {
  format: 'A4',
  couleurAccent: '#BA4037',
  noirEtBlanc: false,
  ordre: 'app',
  afficherPresentation: true,
  afficherProducteur: true,
  couverture: true,
  rappelPat: true,
};

const COULEURS: { cle: CouleurCarte; titre: string; titrePluriel?: string; court: string }[] = [
  { cle: 'bulles', titre: 'Les bulles', court: 'Bulles' },
  { cle: 'blanc', titre: 'Les blancs', court: 'Blancs' },
  { cle: 'rose', titre: 'Les rosés', court: 'Rosés' },
  { cle: 'rouge', titre: 'Les rouges', court: 'Rouges' },
  { cle: 'orange', titre: 'Le vin orange', titrePluriel: 'Les vins orange', court: 'Vin orange' },
  { cle: 'doux', titre: 'Le vin doux', titrePluriel: 'Les vins doux', court: 'Vin doux' },
];

const echapper = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sansAccents = (s: unknown) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

const formatPrix = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** Producteur affiché seulement s'il n'est pas déjà dans le nom du vin (« Pauillac Château Pichon-Longueville »). */
export function producteurAffiche(vin: VinImprimable): string | null {
  if (!vin.producteur || /^non /i.test(vin.producteur)) return null;
  const coeur = sansAccents(vin.producteur.replace(/\s*\(.*\)/, ''))
    .replace(/^(chateau|domaine|dom|bodegas y vinedos|bodegas|cantina|tenuta)\s+/, '')
    .replace(/\s+baron$/, '')
    .trim();
  if (coeur && sansAccents(vin.nom).includes(coeur)) return null;
  return vin.producteur.replace(/\s*\(.*\)/, '');
}

export function ligneDetail(vin: VinImprimable, options: OptionsCarte): string {
  const parts: string[] = [];
  if (options.afficherProducteur) {
    const p = producteurAffiche(vin);
    if (p) parts.push(p);
  }
  if (vin.millesime) parts.push(vin.millesime);
  if (vin.contenance) parts.push(vin.contenance);
  if (vin.prix != null && vin.prixVerre != null) parts.push(`verre ${formatPrix.format(vin.prixVerre)}`);
  return parts.join(' · ');
}

export function prixAffiche(vin: VinImprimable): string {
  if (vin.prix != null) return formatPrix.format(vin.prix);
  if (vin.prixVerre != null) return `${formatPrix.format(vin.prixVerre)} le verre`;
  return '';
}

interface Groupe { cle: CouleurCarte; titre: string; court: string; regions: { nom: string | null; vins: VinImprimable[] }[] }

/** Regroupe par couleur puis par région, dans l'ordre choisi. */
export function organiser(vins: VinImprimable[], options: OptionsCarte): Groupe[] {
  const visibles = vins.filter((v) => v.visible !== false);
  return COULEURS.map(({ cle, titre, titrePluriel, court }) => {
    let liste = visibles.filter((v) => v.couleur === cle);
    const t = liste.length > 1 && titrePluriel ? titrePluriel : titre;
    if (options.ordre === 'prix') {
      liste = [...liste].sort((a, b) => (a.prix ?? a.prixVerre ?? Infinity) - (b.prix ?? b.prixVerre ?? Infinity));
      return { cle, titre: t, court, regions: [{ nom: null, vins: liste }] };
    }
    const regions: Groupe['regions'] = [];
    for (const v of liste) {
      const nom = v.region ?? null;
      let r = regions.find((x) => x.nom === nom);
      if (!r) regions.push((r = { nom, vins: [] }));
      r.vins.push(v);
    }
    return { cle, titre: t, court, regions };
  }).filter((c) => c.regions.some((r) => r.vins.length));
}

/** Présentation affichée sous le vin : celle corrigée par le restaurant, sinon celle de Pat. */
export function texteVin(vin: VinImprimable, options: OptionsCarte): string {
  if (!options.afficherPresentation) return '';
  return (vin.presentationPerso || vin.presentation || '').trim();
}

function htmlVin(vin: VinImprimable, options: OptionsCarte) {
  const detail = ligneDetail(vin, options);
  const mot = texteVin(vin, options);
  return `<div class="vin">
  <div class="vin-ligne">
    <span class="vin-titre"><span class="vin-nom">${echapper(vin.nom)}</span>${detail
      ? ` <span class="vin-detail">${detail.split(' · ').map((d) => `<span>${echapper(d)}</span>`).join(' · ')}</span>` : ''}</span>
    <span class="vin-points" aria-hidden="true"></span>
    <span class="vin-prix">${echapper(prixAffiche(vin))}</span>
  </div>
  ${mot ? `<p class="vin-mot">${echapper(mot)}</p>` : ''}
</div>`;
}

function htmlCouverture(restaurant: RestaurantImprimable, options: OptionsCarte, couleursPresentes: string[]) {
  const logo = options.noirEtBlanc ? restaurant.logoSombreUrl : restaurant.logoUrl;
  const marque = logo
    ? `<img class="couv-logo" src="${echapper(logo)}" alt="${echapper(restaurant.nom)}">`
    : `<span class="couv-nom">${echapper(restaurant.nom)}</span>`;
  const qr = restaurant.qrCodeUrl ? `<img class="couv-qr" src="${echapper(restaurant.qrCodeUrl)}" alt="QR code de ${echapper(restaurant.nom)}">` : '';
  return `<section class="couverture">
  <div class="couv-bandeau">${marque}</div>
  <div class="couv-corps">
    <h1>Carte des vins</h1>
    <span class="couv-filet" aria-hidden="true"></span>
    <p class="couv-couleurs">${echapper(couleursPresentes.join(' · '))}</p>
    ${options.rappelPat ? `<div class="couv-pat">${qr}<p>Un conseil pour votre plat ? Scannez ce code : Pat vous propose trois vins de la carte.</p></div>` : ''}
  </div>
  ${restaurant.patLogoUrl ? `<div class="couv-signature"><img src="${echapper(restaurant.patLogoUrl)}" alt=""><span>Pat le sommelier</span></div>` : ''}
</section>`;
}

const chaineCss = (s: string) => '"' + String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const couleurSure = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : OPTIONS_PAR_DEFAUT.couleurAccent);

function css(options: OptionsCarte, restaurant: RestaurantImprimable) {
  const accent = options.noirEtBlanc ? '#1F1A1C' : couleurSure(options.couleurAccent);
  const a5 = options.format === 'A5';
  return `
@page { size: ${a5 ? 'A5' : 'A4'}; margin: ${a5 ? '12mm 13mm 12mm' : '16mm 19mm 14mm'};
  @top-left { content: ${chaineCss(restaurant.nom.toUpperCase())}; font: 700 8.5pt Lato, 'Helvetica Neue', sans-serif; letter-spacing: 3px; color: ${accent}; vertical-align: bottom; padding-bottom: 3mm; }
  @top-right { content: "Carte des vins"; font: italic 500 12pt 'Cormorant Garamond', Garamond, serif; color: #5E5357; vertical-align: bottom; padding-bottom: 3mm; }
  @bottom-center { content: counter(page); font: 500 11pt 'Cormorant Garamond', Garamond, serif; color: #5E5357; }${restaurant.patLogoUrl ? `
  /* Petit logo de Pat en bas à gauche de chaque page (image en fond de la marge, texte à côté). */
  @bottom-left { content: "Pat le sommelier"; font: italic 500 ${a5 ? '8pt' : '8.5pt'} 'Cormorant Garamond', Garamond, serif; color: #5E5357;
    vertical-align: middle; padding-left: ${a5 ? '6.5mm' : '7.5mm'};
    background: url(${chaineCss(restaurant.patLogoUrl)}) no-repeat left center / auto ${a5 ? '5.5mm' : '6.5mm'}; }` : ''}
}
@page couverture { margin: 0; @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } @bottom-left { content: none; background: none; } }
* { box-sizing: border-box; }
html, body { margin: 0; background: #FFFFFF; }
body { font-family: Lato, 'Helvetica Neue', Helvetica, sans-serif; color: #1F1A1C;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: ${a5 ? '10pt' : '11pt'}; }
.couverture { page: couverture; break-after: page; height: ${a5 ? '210mm' : '297mm'}; display: flex; flex-direction: column; position: relative; }
.couv-bandeau { height: 44%; background: ${options.noirEtBlanc ? '#FFFFFF' : accent}; display: flex; align-items: center; justify-content: center;
  ${options.noirEtBlanc ? 'border-bottom: 1px solid #E2D8DB;' : ''} }
.couv-logo { width: 42%; height: auto; max-height: 60%; object-fit: contain; }
.couv-nom { font: 600 ${a5 ? '40pt' : '54pt'} 'Cormorant Garamond', Garamond, serif; color: ${options.noirEtBlanc ? '#1F1A1C' : '#FFFFFF'}; }
.couv-corps { flex: 1; padding: 18mm 24mm ${a5 ? '24mm' : '32mm'}; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6mm; }
.couv-corps h1 { margin: 0; font: 600 ${a5 ? '40pt' : '54pt'}/1 'Cormorant Garamond', Garamond, serif; letter-spacing: -0.5px; }
.couv-filet { width: 15mm; height: 2px; background: ${accent}; }
.couv-couleurs { margin: 0; font-size: 9pt; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; color: #5E5357; }
.couv-pat { margin-top: auto; display: flex; align-items: center; gap: 5mm; text-align: left; }
.couv-pat p { margin: 0; max-width: 80mm; font: 500 ${a5 ? '11pt' : '13.5pt'}/1.35 'Cormorant Garamond', Garamond, serif; }
.couv-qr { width: 25mm; height: 25mm; }
.couv-signature { position: absolute; left: ${a5 ? '13mm' : '19mm'}; bottom: ${a5 ? '4mm' : '5mm'}; display: flex; align-items: center; gap: 1.5mm; }
.couv-signature img { height: ${a5 ? '5.5mm' : '6.5mm'}; width: auto; ${options.noirEtBlanc ? 'filter: grayscale(1) brightness(0.45);' : ''} }
.couv-signature span { font: italic 500 ${a5 ? '8pt' : '8.5pt'} 'Cormorant Garamond', Garamond, serif; color: #5E5357; }
.entete { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 2.5mm; margin-bottom: 5mm; border-bottom: 1px solid #E2D8DB; }
.entete-nom { font-size: 8.5pt; font-weight: 700; letter-spacing: 3.4px; text-transform: uppercase; color: ${accent}; }
.entete-titre { font: italic 500 12pt 'Cormorant Garamond', Garamond, serif; color: #5E5357; }
.couleur { margin-bottom: 4mm; }
.couleur > h2 { display: flex; align-items: center; gap: 4mm; margin: 4mm 0 3mm; font: 600 ${a5 ? '20pt' : '27pt'}/1.1 'Cormorant Garamond', Garamond, serif; break-after: avoid; }
.couleur > h2::before { content: ""; width: 7mm; height: 2px; background: ${accent}; }
.region > h3 { display: flex; align-items: center; gap: 3mm; margin: 3.5mm 0 2.5mm; font-size: 8.5pt; font-weight: 700; letter-spacing: 2.2px; text-transform: uppercase; color: ${accent}; break-after: avoid; }
.region > h3::after { content: ""; flex: 1; height: 1px; background: #E2D8DB; }
.vin { break-inside: avoid; margin-bottom: 4.5mm; }
.vin-ligne { display: flex; align-items: baseline; gap: 2.6mm; }
.vin-nom { font: 600 ${a5 ? '12pt' : '14pt'}/1.2 'Cormorant Garamond', Garamond, serif; }
/* Nom et détail dans le même flux de texte : un long domaine passe à la ligne juste après le nom, sans trou. */
.vin-titre { flex: 0 1 auto; min-width: 0; }
.vin-detail { font-size: 9pt; color: #5E5357; margin-left: 1.6mm; }
.vin-detail > span { white-space: nowrap; }
.vin-points { flex: 1 1 6mm; min-width: 6mm; border-bottom: 1px dotted #A99DA1; transform: translateY(-1mm); }
.vin-prix { font-size: 10.5pt; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vin-mot { margin: 0.8mm 0 0; font: italic 500 ${a5 ? '10.5pt' : '12pt'}/1.38 'Cormorant Garamond', Garamond, serif; color: #3F3739; text-wrap: pretty; }
.fin { break-inside: avoid; margin-top: 8mm; padding-top: 5mm; border-top: 1px solid #E2D8DB; text-align: center; }
.fin p { margin: 0 0 2mm; }
.fin .fin-pat { font: italic 500 13.5pt 'Cormorant Garamond', Garamond, serif; }
.fin .fin-mention { font-size: 9pt; color: #5E5357; }
@media screen {
  body { background: #EDE6E8; padding: 24px 0; }
  .couverture, .pages { width: ${a5 ? '148mm' : '210mm'}; margin: 0 auto 24px; background: #FFFFFF; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
  .pages { padding: 16mm 19mm 14mm; }
}
@media print { .pages { padding: 0; } .entete { display: none; } .barre-impression { display: none !important; } }
`;
}

/**
 * Point d'entrée : renvoie le document HTML complet.
 * `barre` : HTML d'une barre d'outils affichée à l'écran seulement (options, bouton Imprimer), jamais imprimée.
 */
export function genererCarteHTML({ restaurant, vins, options: opts = {}, barre = '' }:
  { restaurant: RestaurantImprimable; vins: VinImprimable[]; options?: Partial<OptionsCarte>; barre?: string }): string {
  const options = { ...OPTIONS_PAR_DEFAUT, ...opts };
  const couleurs = organiser(vins, options);
  const nbVins = couleurs.reduce((n, c) => n + c.regions.reduce((m, r) => m + r.vins.length, 0), 0);

  const corps = couleurs
    .map((c) => `<section class="couleur">
  <h2>${echapper(c.titre)}</h2>
  ${c.regions.map((r) => `<div class="region">
    ${r.nom ? `<h3>${echapper(r.nom)}</h3>` : ''}
    ${r.vins.map((v) => htmlVin(v, options)).join('\n')}
  </div>`).join('\n')}
</section>`)
    .join('\n');

  const fin = `<div class="fin">
  ${options.rappelPat ? '<p class="fin-pat">Une hésitation ? Scannez le QR code de votre table : Pat vous conseille un vin pour votre plat.</p>' : ''}
  <p class="fin-mention">Tous nos millésimes sont donnés sous réserve de disponibilité.</p>
</div>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(restaurant.nom)} — carte des vins</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Lato:wght@400;700&display=swap">
<style>${css(options, restaurant)}</style>
</head>
<body data-nb-vins="${nbVins}">
${barre}
${options.couverture ? htmlCouverture(restaurant, options, couleurs.map((c) => (c.regions.reduce((n, r) => n + r.vins.length, 0) > 1 && c.titre.startsWith('Les') ? c.titre.replace(/^Les /, '').replace(/^./, (x) => x.toUpperCase()) : c.court))) : ''}
<main class="pages">
  <header class="entete"><span class="entete-nom">${echapper(restaurant.nom)}</span><span class="entete-titre">Carte des vins</span></header>
  ${corps}
  ${fin}
</main>
</body>
</html>`;
}
