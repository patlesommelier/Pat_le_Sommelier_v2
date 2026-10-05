// Pat le sommelier — points de raccordement du parcours d'inscription avec le reste de l'app.
// Lecture du menu et de la carte (Claude lit les photos et les PDF), rapprochement avec la base de Pat,
// création des producteurs proposés et lancement de la préparation des accords (file existante).
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { requete } from '../db';
import { creerLot, travailler } from '../generation/file';
import { creerLotPresentations, presentationsManquantes, travaillerPresentations } from '../generation/file-presentations';
import type { Plat, Vin, VinRapproche } from './donnees';

export type FichierEnvoye = { nom: string; type: string; octets: Uint8Array };

const modele = () => process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5';
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

async function lire(fichiers: FichierEnvoye[], consigne: string): Promise<unknown[]> {
  const client = new Anthropic({ maxRetries: 3 });
  const m = await client.messages.stream({
    model: modele(), max_tokens: 32000,
    messages: [{ role: 'user', content: [...await blocs(fichiers), { type: 'text', text: consigne }] }],
  }).finalMessage();
  return lireTableau(m.content.map((b) => (b.type === 'text' ? b.text : '')).join(''));
}

const CONSIGNE_MENU = `Ces documents sont les pages du menu d'un restaurant (photos ou PDF). Relève chaque plat proposé.
Pour chaque plat : « nom » tel qu'écrit sur le menu (sans le prix), « categorie » parmi entree, plat, dessert, fromage
(une planche ou un en-cas : entree), et « description » : les ingrédients, la cuisson ou la sauce indiqués sur le menu (null s'il n'y en a pas).
Ignore les boissons, les vins, les suppléments isolés et les formules sans plat précis. N'invente rien.
Réponds uniquement en JSON, sans texte autour : [{"nom": "...", "categorie": "plat", "description": "..."}]`;

const CONSIGNE_CARTE = `Ces documents sont les pages de la carte des vins d'un restaurant (photos ou PDF). Relève chaque vin.
Pour chaque vin : « libelleCarte » (nom tel qu'écrit, appellation et cuvée, sans millésime ni prix), « producteur »
(domaine, château ou maison ; null si la carte ne l'indique pas — ne le devine pas), « appellation » (ou null),
« millesime » (4 chiffres, « 2019-2020 » si deux ; null si non millésimé), « contenance » (« 37,5 cl », « 150 cl »… ; null pour 75 cl),
« prix » (prix de la bouteille en euros, nombre ; null si absent), « prixVerre » (prix au verre, nombre, ou null),
« auVerre » (true si le vin n'est servi qu'au verre), « couleur » parmi bulles, blanc, rose, orange, rouge, doux
(tout effervescent : bulles ; vin doux, liquoreux ou muté : doux), « region » (titre de section de la carte, ou null).
Un même vin en deux contenances donne deux lignes. N'invente rien.
Réponds uniquement en JSON, sans texte autour : [{"libelleCarte": "...", "producteur": null, "appellation": null, "millesime": "2022",
"contenance": null, "prix": 58, "prixVerre": null, "auVerre": false, "couleur": "blanc", "region": "Loire"}]`;

/** Lit le menu (photos ou PDF) et renvoie les plats. Données brutes : elles seront validées par `Plat`. */
export async function analyserMenu(fichiers: FichierEnvoye[]): Promise<unknown[]> {
  return lire(fichiers, CONSIGNE_MENU);
}

/** Lit la carte des vins (photos ou PDF) et renvoie les vins. Données brutes : validées par `Vin`. */
export async function analyserCarte(fichiers: FichierEnvoye[]): Promise<unknown[]> {
  return lire(fichiers, CONSIGNE_CARTE);
}

// ─── Rapprochement avec la base de Pat ───

const SANS_ACCENTS = `translate(lower(nom), 'àâäáãéèêëíìîïóòôöõúùûüçñœ', 'aaaaaeeeeiiiiooooouuuucno')`;
const MOTS_VIDES = new Set(['domaine', 'chateau', 'maison', 'cave', 'caves', 'cantina', 'bodegas', 'bodega', 'tenuta', 'weingut', 'clos',
  'des', 'du', 'de', 'la', 'le', 'les', 'et', 'fils', 'freres', 'pere', 'vignerons', 'vignobles', 'famille', 'the']);
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe');
const mots = (t: string) => [...new Set(norm(t).split(/[^a-z0-9]+/).filter((m) => m.length > 2 && !MOTS_VIDES.has(m)))];

/** Producteur de la base dont le nom contient tous les mots significatifs du nom lu sur la carte (le plus court d'abord). */
async function producteurConnu(nom: string): Promise<{ id: string; statut: string } | null> {
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
export async function rapprocherVins(vins: Vin[]): Promise<VinRapproche[]> {
  return Promise.all(vins.map(async (v) => {
    const p = v.producteur ? await producteurConnu(v.producteur) : null;
    return { ...v, vinId: p?.id ?? null, producteurStatut: p?.statut === 'valide' ? 'reference' as const : 'nouveau' as const };
  }));
}

const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/**
 * Crée les producteurs inconnus au statut « proposé » (file « Producteurs à valider » du super-admin)
 * et renvoie, pour chaque vin de la carte, l'identifiant de son producteur (null si la carte ne l'indique pas).
 */
export async function creerVinsEnAttente(_restaurantId: string, vins: VinRapproche[]): Promise<Array<string | null>> {
  const crees = new Map<string, string>();
  const out: Array<string | null> = [];
  for (const v of vins) {
    if (v.vinId) { out.push(v.vinId); continue; }
    if (!v.producteur) { out.push(null); continue; }
    const cle = mots(v.producteur).join('-') || slug(v.producteur);
    if (!crees.has(cle)) {
      const existant = await producteurConnu(v.producteur);
      const id = existant?.id ?? `inscription-prod-${slug(v.producteur)}`;
      if (!existant) {
        await requete(
          `insert into producteur (id, nom, region, statut, source, a_verifier) values ($1, $2, $3, 'propose', 'inscription', $4)
           on conflict (id) do nothing`,
          [id, v.producteur, v.region, `Repéré sur une carte à l'inscription : ${v.libelleCarte}${v.appellation ? ` (${v.appellation})` : ''}`]);
      }
      crees.set(cle, id);
    }
    out.push(crees.get(cle)!);
  }
  return out;
}

/** Adresse publique du site, pour réveiller les fonctions d'arrière-plan depuis le serveur. */
const origineSite = () => (process.env.URL ?? process.env.URL_PUBLIQUE ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/**
 * Prépare les accords d'un restaurant : une tâche par plat dans la file des régénérations (Pat note chaque vin
 * sur chaque plat), puis les présentations de la carte imprimable. Les tâches sont traitées par les fonctions
 * Netlify d'arrière-plan ; hors Netlify (développement local), par le serveur lui-même.
 * L'avancement se lit dans la file (etatDernierLot) ; le restaurant passe « en service » à la fin (voir travailler).
 */
export async function preparerAccords(restaurantId: string, demandePar = 'inscription', { seulementManquants = false } = {}): Promise<void> {
  // Relance : seulement les plats sans accord ou en échec à la dernière préparation (pas de nouvel appel pour les autres).
  const plats = await requete<{ id: string }>(
    `select pl.id from plat pl where pl.restaurant_id = $1 and pl.actif
        and (not $2 or not exists (select 1 from accord a where a.plat_id = pl.id)
             or exists (select 1 from generation_accords g where g.plat_id = pl.id and g.statut = 'erreur'
                          and g.lot = (select lot from generation_accords where restaurant_id = $1 order by cree_le desc, id desc limit 1)))
      order by pl.ordre`, [restaurantId, seulementManquants]);
  const { crees } = await creerLot(requete, restaurantId, plats.map((p) => p.id), demandePar);
  const manquantes = await presentationsManquantes(requete, restaurantId);
  const presentations = manquantes.length ? await creerLotPresentations(requete, restaurantId, manquantes.map((m) => m.couleur), demandePar) : 0;
  const base = origineSite();
  const appeler = (fonction: string, n: number) => Promise.all(Array.from({ length: Math.min(3, n) }, () =>
    base ? fetch(`${base}/.netlify/functions/${fonction}`, { method: 'POST' }).then((r) => r.status).catch(() => 0) : Promise.resolve(0)));
  const [accords, pres] = await Promise.all([appeler('generer-accords-background', crees), appeler('generer-presentations-background', presentations)]);
  const lance = (s: number[]) => s.some((x) => x === 202 || x === 200);
  // Hors Netlify : le serveur traite les files lui-même, sans faire attendre la page.
  if (crees && !lance(accords)) void travailler(requete, { finAvant: Date.now() + 60 * 60 * 1000 }).catch((e) => console.error('[inscription]', e));
  if (presentations && !lance(pres)) void travaillerPresentations(requete, { finAvant: Date.now() + 60 * 60 * 1000 }).catch((e) => console.error('[inscription]', e));
}

export type { Plat };
