// Pat le sommelier — lecture du menu et de la carte des vins par Claude, et rapprochement avec la base de Pat.
// Sans 'server-only' : aussi appelé par la fonction Netlify d'arrière-plan (lecture de l'inscription).
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import type { Requete } from '../generation/accords';
import type { Vin, VinRapproche } from './donnees';
import { clientClaude, modeleLecture } from '../claude';

export type FichierEnvoye = { nom: string; type: string; octets: Uint8Array };

const modele = modeleLecture;
const IMAGE_MAX = 1800; // px, côté le plus long : assez pour lire une carte, sans alourdir la requête

/** Contenu envoyé à Claude : PDF tel quel, photos remises en JPEG (HEIC de l'iPhone compris) et réduites. */
async function blocs(fichiers: FichierEnvoye[]): Promise<Anthropic.ContentBlockParam[]> {
  return Promise.all(fichiers.map(async (f): Promise<Anthropic.ContentBlockParam> => {
    if (f.type === 'application/pdf') {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(f.octets).toString('base64') } };
    }
    let jpeg: Buffer;
    try {
      jpeg = await sharp(f.octets).rotate().resize(IMAGE_MAX, IMAGE_MAX, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      throw new Error(`${f.nom} : image illisible. Envoyez-la en JPEG ou en PDF.`);
    }
    return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } };
  }));
}

function lireTableau(texte: string): unknown[] {
  const debut = texte.indexOf('['), fin = texte.lastIndexOf(']');
  if (debut < 0 || fin < debut) return [];
  try {
    const v = JSON.parse(texte.slice(debut, fin + 1));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Document déposé à la mauvaise étape (un menu de plats à la place de la carte des vins, ou l'inverse). */
export class MauvaisDocument extends Error {
  constructor(message: string) { super(message); this.name = 'MauvaisDocument'; }
}

// Réponse convenue quand le document n'est pas celui attendu (voir les consignes ci-dessous).
const SIGNAL = { carte: 'MENU_DE_PLATS', menu: 'CARTE_DES_VINS' } as const;
const MAUVAIS: Record<keyof typeof SIGNAL, string> = {
  carte: 'Ce document ressemble à un menu de plats, pas à une carte des vins. Déposez ici votre carte des vins : le menu viendra à l’étape suivante.',
  menu: 'Ce document ressemble à une carte des vins, pas à un menu. Déposez ici votre menu, avec vos plats.',
};

async function lire(fichiers: FichierEnvoye[], consigne: string, attendu: keyof typeof SIGNAL): Promise<unknown[]> {
  const client = clientClaude({ maxRetries: 3 });
  const m = await client.messages.stream({
    model: modele(), max_tokens: 32000,
    messages: [{ role: 'user', content: [...await blocs(fichiers), { type: 'text', text: consigne }] }],
  }).finalMessage();
  const texte = m.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  if (texte.includes(SIGNAL[attendu]) && !texte.includes('[{')) throw new MauvaisDocument(MAUVAIS[attendu]);
  return lireTableau(texte);
}

const CONSIGNE_MENU = `Ces documents sont les pages du menu d'un restaurant (photos ou PDF). Relève chaque plat proposé.
Pour chaque plat : « nom » tel qu'écrit sur le menu (sans le prix), « categorie » parmi entree, plat, dessert, fromage
(une planche ou un en-cas : entree), « description » : les ingrédients, la cuisson ou la sauce indiqués sur le menu (null s'il n'y en a pas),
« prix » : le prix du plat en euros, nombre (le plus petit s'il y en a plusieurs ; null si absent), et « prixVariantes » : le détail
quand le menu donne plusieurs prix pour ce plat, ex. « 1 pièce 12 € / 2 pièces 22 € » (null sinon).
Ignore les boissons, les vins, les suppléments isolés et les formules sans plat précis. N'invente rien.
Si ces documents ne contiennent aucun plat mais une carte des vins ou des boissons, réponds exactement CARTE_DES_VINS, sans rien d'autre.
Sinon, réponds uniquement en JSON, sans texte autour : [{"nom": "...", "categorie": "plat", "description": "...", "prix": 24, "prixVariantes": null}]`;

const CONSIGNE_CARTE = `Ces documents sont les pages de la carte des vins d'un restaurant (photos ou PDF). Relève chaque vin.
Pour chaque vin : « libelleCarte » (nom tel qu'écrit, appellation et cuvée, sans millésime ni prix ; quand la carte groupe
plusieurs vins sous un titre — une maison, un domaine —, garde ce titre et ajoute ce qui distingue chaque vin : rosé, blanc de blancs,
brut nature, nom de cuvée… Deux vins différents n'ont jamais le même libelleCarte), « producteur »
(domaine, château ou maison ; quand il figure dans le nom du vin — « Sancerre Picard », « Ostal Cazes »,
« Saint-Amour – Dom. de l'Oiseau de Passage » —, recopie-le aussi ici, abréviations développées (Domaine, Château) ;
null si la carte ne l'indique pas — ne le devine pas), « appellation » (ou null),
« millesime » (4 chiffres, « 2019-2020 » si deux ; null si non millésimé), « contenance » (« 37,5 cl », « 150 cl »… ; null pour 75 cl),
« prix » (prix de la bouteille en euros, nombre ; null si absent), « prixVerre » (prix au verre, nombre, ou null),
« auVerre » (true si le vin n'est servi qu'au verre), « couleur » parmi bulles, blanc, rose, orange, rouge, doux, sans_alcool
(vin sans alcool ou désalcoolisé, même pétillant : sans_alcool ; tout autre effervescent : bulles ; vin doux, liquoreux ou muté : doux), « region » (titre de section de la carte, ou null),
« cepages » (cépages indiqués sur la carte, séparés par des virgules ; null s'ils n'y figurent pas — ne les devine pas).
Un même vin en deux contenances donne deux lignes. N'invente rien.
Si ces documents ne contiennent aucun vin mais un menu de plats (entrées, plats, desserts), réponds exactement MENU_DE_PLATS, sans rien d'autre.
Sinon, réponds uniquement en JSON, sans texte autour : [{"libelleCarte": "...", "producteur": null, "appellation": null, "millesime": "2022",
"contenance": null, "prix": 58, "prixVerre": null, "auVerre": false, "couleur": "blanc", "region": "Loire", "cepages": "Sauvignon blanc"}]`;

/** Lit le menu (photos ou PDF) et renvoie les plats. Données brutes : elles seront validées par `Plat`. */
export async function analyserMenu(fichiers: FichierEnvoye[]): Promise<unknown[]> {
  return lire(fichiers, CONSIGNE_MENU, 'menu');
}

/**
 * Lit la carte des vins (photos ou PDF) et renvoie les vins. Données brutes : validées par `Vin`.
 * Plusieurs fichiers : lus un par un (quatre à la fois), Claude est plus précis sur une seule page ;
 * une page qui n'est pas une carte des vins est ignorée, sauf si aucune ne l'est.
 */
export async function analyserCarte(fichiers: FichierEnvoye[]): Promise<unknown[]> {
  if (fichiers.length < 2) return lire(fichiers, CONSIGNE_CARTE, 'carte');
  const resultats: Array<unknown[] | MauvaisDocument> = [];
  for (let i = 0; i < fichiers.length; i += 4) {
    resultats.push(...await Promise.all(fichiers.slice(i, i + 4).map((f) =>
      lire([f], CONSIGNE_CARTE, 'carte').catch((e) => { if (e instanceof MauvaisDocument) return e; throw e; }))));
  }
  const pages = resultats.filter((r): r is unknown[] => Array.isArray(r));
  if (!pages.length) throw resultats.find((r) => r instanceof MauvaisDocument) ?? new MauvaisDocument(MAUVAIS.carte);
  return pages.flat();
}

// ─── Rapprochement avec la base de Pat ───

const SANS_ACCENTS = `translate(lower(nom), 'àâäáãéèêëíìîïóòôöõúùûüçñœ', 'aaaaaeeeeiiiiooooouuuucno')`;
const MOTS_VIDES = new Set(['domaine', 'chateau', 'maison', 'cave', 'caves', 'cantina', 'bodegas', 'bodega', 'tenuta', 'weingut', 'clos',
  'des', 'du', 'de', 'la', 'le', 'les', 'et', 'fils', 'freres', 'pere', 'vignerons', 'vignobles', 'famille', 'the']);
export const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe');
export const mots = (t: string) => [...new Set(norm(t).split(/[^a-z0-9]+/).filter((m) => m.length > 2 && !MOTS_VIDES.has(m)))];

/** Producteur de la base dont le nom contient tous les mots significatifs du nom lu sur la carte (le plus court d'abord). */
export async function producteurConnu(requete: Requete, nom: string): Promise<{ id: string; statut: string } | null> {
  const m = mots(nom);
  if (!m.length) return null;
  const lignes = await requete<{ id: string; nom: string; statut: string }>(
    `select id, nom, statut::text from producteur where statut <> 'retire' and ${SANS_ACCENTS} like all($1) order by length(nom) limit 5`,
    [m.map((x) => `%${x}%`)]);
  const p = lignes.find((l) => m.every((x) => norm(l.nom).includes(x)));
  return p ? { id: p.id, statut: p.statut } : null;
}

/**
 * Rattache chaque vin à la base de Pat. Renvoie `vinId` (le producteur de la base) et `producteurStatut` seulement :
 * AUCUN ranking ne sort d'ici, le résultat est affiché au restaurateur. Ne crée rien en base.
 */
export async function rapprocherVins(requete: Requete, vins: Vin[]): Promise<VinRapproche[]> {
  vins = await producteursDansLeNom(requete, vins);
  return Promise.all(vins.map(async (v) => {
    const p = v.producteur ? await producteurConnu(requete, v.producteur) : null;
    return { ...v, vinId: p?.id ?? null, producteurStatut: p?.statut === 'valide' ? 'reference' as const : 'nouveau' as const };
  }));
}


// Mots trop communs pour désigner un producteur à eux seuls (cépages et mentions de la carte).
const NON_PRODUCTEURS = new Set(['chardonnay', 'sauvignon', 'pinot', 'noir', 'blanc', 'rouge', 'rose', 'merlot', 'syrah', 'grenache', 'gamay',
  'riesling', 'chenin', 'cabernet', 'malbec', 'viognier', 'cuvee', 'reserve', 'brut', 'grand', 'premier', 'cru', 'vieilles', 'vignes', 'prestige']);

/**
 * Producteur resté vide mais présent dans le nom du vin (« Sancerre Picard », « Ostal Cazes ») : retrouvé parmi
 * les producteurs de la base de Pat. Tous les mots significatifs du producteur doivent figurer dans le nom ; ce ne doit
 * être ni une appellation (« Margaux » n'est pas Château Margaux) ni un cépage ; et le producteur doit produire dans
 * l'appellation du vin (« Chablis Saint-Pierre » n'est pas le Domaine de Saint-Pierre du Jura). En cas de doute, rien.
 */
export async function producteursDansLeNom(requete: Requete, vins: Vin[]): Promise<Vin[]> {
  if (!vins.some((v) => !v.producteur)) return vins;
  const [producteurs, terroirs] = await Promise.all([
    requete<{ nom: string; appellations: string[] | null; region: string | null }>(
      `select nom, appellations_texte as appellations, region from producteur where statut <> 'retire'`),
    requete<{ nom: string }>(`select nom from terroir where statut <> 'retire'`),
  ]);
  const sansMention = (s: string) => s.replace(/\s+(AOC|AOP|DOC|DOCG|DO|IGP|IGT)$/i, '');
  const appellations = new Set(terroirs.map((t) => mots(sansMention(t.nom)).join(' ')).filter(Boolean));
  const candidats = producteurs.map((p) => ({ nom: p.nom, m: mots(p.nom),
    zones: [...(p.appellations ?? []), p.region ?? ''].map((a) => mots(sansMention(a)).join(' ')).filter(Boolean) }))
    .filter((p) => p.m.length && p.m.join('').length >= 4 && !appellations.has(p.m.join(' ')) && !p.m.every((x) => NON_PRODUCTEURS.has(x)));
  return vins.map((v) => {
    if (v.producteur) return v;
    const libelle = mots(v.libelleCarte.replace(/\bDom\./g, 'Domaine').replace(/\bCh\./g, 'Château'));
    // Appellation du vin : celle lue sur la carte, sinon la plus longue appellation de la base au début du nom.
    const lue = v.appellation ? mots(sansMention(v.appellation)).join(' ') : '';
    const debut = [...appellations].filter((a) => ` ${libelle.join(' ')} `.startsWith(` ${a} `)).sort((a, b) => b.length - a.length)[0] ?? '';
    const appellation = lue || debut;
    if (!appellation) return v; // sans appellation, impossible de vérifier : on ne devine pas
    const trouves = candidats.filter((p) => p.m.every((x) => libelle.includes(x)) && (p.m.length < libelle.length || p.m.length >= 2)
      && p.zones.some((z) => z === appellation || ` ${z} `.includes(` ${appellation} `) || ` ${appellation} `.includes(` ${z} `)));
    if (!trouves.length) return v;
    const max = Math.max(...trouves.map((p) => p.m.length));
    const meilleurs = [...new Set(trouves.filter((p) => p.m.length === max).map((p) => p.m.join(' ')))];
    if (meilleurs.length !== 1) return v; // plusieurs producteurs possibles : on ne choisit pas
    const choisi = trouves.filter((p) => p.m.join(' ') === meilleurs[0]).sort((a, b) => a.nom.length - b.nom.length)[0];
    return { ...v, producteur: choisi.nom };
  });
}
