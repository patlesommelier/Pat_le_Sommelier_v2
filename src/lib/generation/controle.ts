/**
 * Contrôles des commentaires d'accord générés (npm run commentaires, régénération des accords) : fonctions pures.
 * Un commentaire fautif est régénéré ; ceux qui restent fautifs ne sont pas enregistrés.
 */

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/['’]/g, ' ');

/** Mots et tournures interdits dans un commentaire client, avec leurs variantes (limité, manquer, correcte, conviendra…). */
export const MOTS_INTERDITS: [string, RegExp][] = [
  ['plafonne', /\bplafonn\w*/],
  ['limite', /\blimit\w*/],
  ['manque', /\bmanqu\w*/],
  ['trop', /\btrop\b/],
  ['faute de', /\bfaute de\b/],
  ['sans point d’ancrage', /\bsans point d ancrage\b/],
  ['correct', /\bcorrect\w*/],
  ['convient', /\bconvien\w*|\bconvenir\b|\bconvenable\w*/],
];

export const MOTS_MIN = 12;
export const MOTS_MAX = 22;

const VIDES = new Set(('le la les un une des du de d l au aux et ou a en sur avec pour par dans son sa ses ce cette ces qui que dont il elle se sa leur leurs plus tres bien tout tous toute ' +
  'est sont vin vins plat accord ici y ne pas').split(' '));

/** Indices d'un élément propre au vin quand ni le cépage, ni le producteur, ni l'appellation n'apparaissent tels quels. */
const PROPRE_AU_VIN = /\b(elevage|eleve|lies|fut|futs|barrique|cuve|amphore|dosage|brut|extra|zero dosage|terroir|schiste|calcaire|granit\w*|argil\w*|marne\w*|silex|galets|altitude|vieilles vignes|vignes|vigneron\w*|domaine|chateau|maison|cooperative|millesime|appellation|cru|clos|coteau\w*|versant\w*|riesling|chardonnay|pinot|gamay|syrah|grenache|merlot|cabernet|sauvignon|chenin|savagnin|nebbiolo|sangiovese|tempranillo|malbec|mourvedre|cinsault|viognier|marsanne|roussanne|semillon|muscat|melon|aligote|trousseau|poulsard|mondeuse|jacquere|carignan|vermentino|touriga|trincadeira|lagrein|nerello|carricante|mencia|alicante|tannat|negrette|fer servadou|petit verdot)\b/;

export const nombreMots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

function motsPleins(t: string) {
  return new Set(sansAccents(t).split(/[^a-z0-9]+/).filter((m) => m.length > 2 && !VIDES.has(m)));
}

/** Similarité de deux commentaires (mots pleins communs / mots pleins réunis). */
export function similarite(a: string, b: string) {
  const x = motsPleins(a), y = motsPleins(b);
  if (!x.size || !y.size) return 0;
  let communs = 0;
  for (const m of x) if (y.has(m)) communs++;
  return communs / (x.size + y.size - communs);
}

const debut = (t: string) => sansAccents(t).split(/[^a-z0-9]+/).filter(Boolean).slice(0, 4).join(' ');

export interface VinAControler {
  vin: string;
  note: number;
  commentaire: string;
  /** Mots qui désignent le vin : cépages, producteur, appellation, libellé. */
  reperes: string[];
  /** Pour un vin noté 2/5 ou moins : le plat où il s'exprime le mieux (nom court). */
  meilleurPlat?: string | null;
}

/** Défauts d'un commentaire pris seul. */
export function defautsCommentaire(c: VinAControler): string[] {
  const d: string[] = [];
  const t = sansAccents(c.commentaire);
  const n = nombreMots(c.commentaire);
  if (n < MOTS_MIN || n > MOTS_MAX) d.push(`${n} mots (attendu : ${MOTS_MIN} à ${MOTS_MAX})`);
  for (const [mot, re] of MOTS_INTERDITS) if (re.test(t)) d.push(`mot interdit « ${mot} »`);
  const reperes = c.reperes.flatMap((r) => sansAccents(r).split(/[^a-z0-9]+/)).filter((m) => m.length > 3 && !VIDES.has(m));
  if (!reperes.some((m) => new RegExp(`\\b${m}\\b`).test(t)) && !PROPRE_AU_VIN.test(t)) d.push('aucun élément propre au vin (cépage, terroir, élevage, dosage, producteur)');
  if (c.note <= 2 && c.meilleurPlat) {
    const motsPlat = [...motsPleins(c.meilleurPlat)];
    if (motsPlat.length && !motsPlat.some((m) => t.includes(m))) d.push(`ne dit pas sur quel plat il s'exprime mieux (${c.meilleurPlat})`);
  }
  return d;
}

/**
 * Défauts de tous les commentaires d'un plat : défauts propres, puis quasi-doublons
 * (même début, ou plus de la moitié des mots pleins en commun) ; le premier de chaque paire est gardé.
 */
export function controlerPlat(vins: VinAControler[], seuilDoublon = 0.5): Map<string, string[]> {
  const out = new Map<string, string[]>();
  vins.forEach((v, i) => {
    const d = defautsCommentaire(v);
    for (const autre of vins.slice(0, i)) {
      if (debut(autre.commentaire) === debut(v.commentaire)) d.push(`même début que ${autre.vin}`);
      else if (similarite(autre.commentaire, v.commentaire) >= seuilDoublon) d.push(`quasi-doublon de ${autre.vin}`);
    }
    if (d.length) out.set(v.vin, d);
  });
  return out;
}
