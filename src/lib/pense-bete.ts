/**
 * Pense-bête des serveurs : un tableau sur une seule page, chaque plat avec les trois vins que Pat propose en premier dans l'app.
 * Fonction pure, sans dépendance. Jamais de note, de ranking ni de score : seulement les noms et les prix.
 * Tout tient sur une page : la taille du texte suit le nombre de plats, puis un petit script la réduit encore si le tableau dépasse.
 */

export interface VinPenseBete { titre: string; detail: string | null; prix: string | null }
export interface LignePenseBete { plat: string; vins: VinPenseBete[] }
export interface SectionPenseBete { titre: string; lignes: LignePenseBete[] }
export interface OptionsPenseBete { paysage: boolean; couleurAccent: string; noirEtBlanc: boolean; prix: boolean }

const echapper = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const couleurSure = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#680021');

/** Taille du texte pour tout faire tenir sur une page : plus il y a de plats, plus elle diminue (entre 6 et 10 pt). */
export function tailleTexte(nbLignes: number, nbSections: number, paysage: boolean) {
  const hauteur = paysage ? 178 : 265; // mm utiles
  const parLigne = (hauteur - 14 - nbSections * 6) / Math.max(1, nbLignes); // mm par plat
  return Math.max(6, Math.min(10, parLigne * 1.15));
}

export function genererPenseBeteHTML({ restaurant, sections, options: o, barre = '' }:
  { restaurant: string; sections: SectionPenseBete[]; options: OptionsPenseBete; barre?: string }) {
  const accent = o.noirEtBlanc ? '#1F1A1C' : couleurSure(o.couleurAccent);
  const remplies = sections.filter((s) => s.lignes.length);
  const n = remplies.reduce((t, s) => t + s.lignes.length, 0);
  const pt = tailleTexte(n, remplies.length, o.paysage);
  const cellule = (v: VinPenseBete | undefined) => v
    ? `<td><span class="vin">${echapper(v.titre)}</span>${v.detail ? `<span class="detail"> ${echapper(v.detail)}</span>` : ''}${o.prix && v.prix ? `<span class="prix">${echapper(v.prix)}</span>` : ''}</td>`
    : '<td class="vide">—</td>';
  const corps = remplies.map((s) => `<tbody>
  <tr class="section"><th colspan="4">${echapper(s.titre)}</th></tr>
  ${s.lignes.map((l) => `<tr><th scope="row" class="plat">${echapper(l.plat)}</th>${[0, 1, 2].map((i) => cellule(l.vins[i])).join('')}</tr>`).join('\n  ')}
</tbody>`).join('\n');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(restaurant)} — pense-bête des accords</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Lato:wght@400;700&display=swap">
<style>
@page { size: A4 ${o.paysage ? 'landscape' : 'portrait'}; margin: 9mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #FFFFFF; }
body { font: ${pt.toFixed(1)}pt/1.25 Lato, 'Helvetica Neue', Helvetica, sans-serif; color: #1F1A1C; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.entete { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.6em; border-bottom: 2px solid ${accent}; padding-bottom: 0.3em; }
.entete h1 { margin: 0; font: 600 1.8em 'Cormorant Garamond', Garamond, serif; }
.entete span { font-size: 0.85em; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; color: ${accent}; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
col.c-plat { width: 25%; }
thead th { text-align: left; font-size: 0.8em; letter-spacing: 1.6px; text-transform: uppercase; color: ${accent}; padding: 0 0.6em 0.3em; }
td, th.plat { vertical-align: top; padding: 0.3em 0.6em; border-bottom: 1px solid #E2D8DB; }
th.plat { text-align: left; font-weight: 700; }
tr.section th { text-align: left; padding: 0.5em 0.4em 0.15em; font: 600 1.3em 'Cormorant Garamond', Garamond, serif; border-bottom: 1px solid ${accent}; break-after: avoid; }
tr { break-inside: avoid; }
.vin { font-weight: 700; }
.detail { color: #5E5357; }
.prix { font-size: 0.88em; color: #3A3235; white-space: nowrap; }
.prix::before { content: ' · '; color: #B9AEB2; }
td.vide { color: #B9AEB2; }
.contenu { width: ${o.paysage ? 279 : 192}mm; margin: 0 auto; }
.fin { margin: 0.5em 0 0; font-size: 0.75em; color: #5E5357; text-align: right; }
@media screen {
  html, body { background: #EEE6E8; }
  body { padding: 24px 12px; }
  .page { width: ${o.paysage ? '297mm' : '210mm'}; min-height: ${o.paysage ? '210mm' : '297mm'}; margin: 0 auto; background: #FFF; padding: 9mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
}
@media print { .barre-impression { display: none !important; } }
</style>
</head>
<body>
${barre}
<main class="page"><div class="contenu">
  <header class="entete"><h1>Pense-bête des accords</h1><span>${echapper(restaurant)}</span></header>
  <table>
    <colgroup><col class="c-plat"><col><col><col></colgroup>
    <thead><tr><th>Plat</th><th>1<sup>er</sup> choix de Pat</th><th>2<sup>e</sup> choix</th><th>3<sup>e</sup> choix</th></tr></thead>
    ${corps || '<tbody><tr><td colspan="4" class="vide">Aucun accord pour le moment.</td></tr></tbody>'}
  </table>
  <p class="fin">Les vins que Pat propose en premier dans l’app, avec vos règles du sommelier · Pat le sommelier</p>
</div></main>
<script>
// Tout sur une seule page : tant que le tableau dépasse la hauteur utile de la feuille, le texte diminue (jusqu'à 5 pt).
(function () {
  var c = document.querySelector('.contenu'), utile = ${o.paysage ? 192 : 279} * 96 / 25.4 * 0.98;
  function ajuster() {
    var pt = 10; // le plus grand possible, puis on réduit
    document.body.style.fontSize = pt + 'pt';
    while (c.getBoundingClientRect().height > utile && pt > 5) { pt -= 0.25; document.body.style.fontSize = pt + 'pt'; }
  }
  ajuster(); window.addEventListener('load', ajuster); window.addEventListener('beforeprint', ajuster);
  if (document.fonts) document.fonts.ready.then(ajuster);
})();
</script>
</body>
</html>`;
}
