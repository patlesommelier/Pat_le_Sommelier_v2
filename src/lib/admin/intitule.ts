// Intitulé d'un vin (« libellé » affiché dans l'app et sur la carte), composé à partir de ses champs modifiables :
// appellation, nom du vin (cuvée), cépage et producteur. Le restaurant peut aussi l'écrire lui-même.
// Sans dépendance serveur : utilisé par le formulaire (navigateur) et par le serveur.

export type ChampsIntitule = { appellation?: string | null; nom?: string | null; cepage?: string | null; producteur?: string | null };

const propre = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
export const cle = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Appellation sans mention d'origine protégée (« Chablis AOC » → « Chablis », « Terre Siciliane IGT / Etna » → « Terre Siciliane »). */
export const appellationCourte = (s: string | null | undefined) => propre(s).replace(/(?<=\S)\s+(AOC|AOP|DOCG|DOCa|DOC|DOP|DO|IGT|IGP)\b.*$/i, '');

/** Appellations qui ne disent pas le cépage (vins de pays, IGP…) : le cépage aide alors à reconnaître le vin. */
const GENERIQUE = /^(IGP|IGT|VdP|Vin de France|Vin de pays|Pays d|Terre|Landwein|Vino de la Tierra)\b/i;
/** Vins de maison (effervescents) : c'est la maison qui distingue le vin (« Champagne Ruinart Blanc de Blancs »). */
const MAISON = /^(Champagne|Crémant|Cava|Franciacorta|Prosecco|Trento|Cap Classique)\b/i;

/**
 * Intitulé proposé : appellation, cépage (seulement s'il est unique et que l'appellation ne le dit pas), puis le nom du vin,
 * ou le producteur quand le vin n'a pas de nom. Un élément déjà contenu dans un autre n'est pas répété.
 * Ex. « Chablis Saint-Pierre », « Chiroubles Domaine Piron », « IGP Val de Loire Sauvignon Le Petit Bourgeois ».
 */
export function composerIntitule({ appellation, nom, cepage, producteur }: ChampsIntitule) {
  const a = appellationCourte(appellation);
  const c = propre(cepage);
  const pr = propre(producteur).replace(/\s*\(.*?\)/g, '');
  // Un « nom » qui n'est que le cépage (« Bourgogne – Chardonnay ») : le vin n'a pas de nom, le cépage est gardé.
  const nomCepage = cle(propre(nom)) !== '' && cle(propre(nom)) === cle(c.split(/[,/&+]| et /)[0]);
  const n = nomCepage ? '' : propre(nom);
  // Cépage déjà cité (même en partie : « Sauvignon » pour « Sauvignon blanc ») : pas répété.
  const dejaCite = c && ` ${cle(`${a} ${n}`)} `.includes(` ${cle(c).split(' ')[0]} `);
  const unCepage = c && !/[,/&+]| et /.test(c);
  const parties = [
    a,
    unCepage && !dejaCite && (nomCepage || !a || GENERIQUE.test(a)) ? c : '',
    MAISON.test(a) && n ? pr : '',
    n || pr,
  ].filter(Boolean);
  const gardees = parties.filter((p, i) => !parties.some((q, j) => j !== i && q.length > p.length && ` ${cle(q)} `.includes(` ${cle(p)} `)));
  return gardees.join(' ');
}

/** Appellation lue sur la carte à l'import (« Pauillac – Le Petit Mouton », notes entre parenthèses retirées), sinon celle de la base de Pat. */
export function appellationDeduite(vinTexte: string | null | undefined, appellationBase?: string | null) {
  // La carte d'abord : elle garde la couleur (« Sancerre rouge »), que le nom de l'appellation de la base n'a pas.
  return appellationCourte(propre(vinTexte).split(' – ')[0].replace(/\(.*?\)/g, '')) || appellationCourte(appellationBase);
}

/** Nom du vin lu sur la carte à l'import (partie après le tiret), sans guillemets ni notes. */
export function nomDeduit(vinTexte: string | null | undefined) {
  const n = propre(propre(vinTexte).split(' – ').slice(1).join(' – ').replace(/\(.*?\)/g, '').replace(/[«»"]/g, '')).replace(/\s+Brut$/i, '');
  return /non précisée|à préciser/i.test(n) ? '' : n;
}

/**
 * Présentation d'un vin dans la carte des vins de l'app : en gras le nom du vin et son millésime ; en dessous le producteur,
 * l'appellation et les cépages. Sans nom de vin (ou un « nom » qui n'est que le cépage), l'appellation passe en gras.
 */
export function titreCarte(v: {
  libelle: string; nom_vin?: string | null; vin_texte?: string | null; appellation_texte?: string | null; appellation_nom?: string | null;
  producteur?: string | null; cepages?: string | null; millesime?: string | null;
}, { millesime: avecMillesime = true, cepages: avecCepages = true } = {}) {
  const cepages = propre(v.cepages).replace(/\s*\(.*?\)/g, '');
  const nomBrut = propre(v.nom_vin ?? nomDeduit(v.vin_texte));
  const nom = nomBrut && cle(nomBrut) !== cle(cepages.split(/[,/&+]| et /)[0]) ? nomBrut : '';
  const appellation = appellationCourte(v.appellation_texte ?? appellationDeduite(v.vin_texte, v.appellation_nom));
  const producteur = propre(v.producteur && !/^non /i.test(v.producteur) ? v.producteur : '').replace(/\s*\(.*?\)/g, '');
  const tete = nom || appellation || v.libelle;
  const millesime = avecMillesime && v.millesime && v.millesime !== 'NM' ? v.millesime : '';
  const dessous = [producteur, tete === appellation ? '' : appellation, avecCepages ? cepages : '']
    .filter((x, i, t) => x && !t.slice(0, i).some((y) => y && ` ${cle(y)} `.includes(` ${cle(x)} `)) && !` ${cle(tete)} `.includes(` ${cle(x)} `));
  return { titre: [tete, millesime].filter(Boolean).join(' '), sousTitre: dessous.join(' · ') };
}
