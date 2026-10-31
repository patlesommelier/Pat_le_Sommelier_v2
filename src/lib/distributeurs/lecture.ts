// Lecture du tarif d'un distributeur, puis enregistrement dans la base. Le moins cher d'abord :
// - Excel, CSV ou API dont les colonnes sont reconnues : sans IA ;
// - PDF avec du texte (le cas courant), ou tableau aux colonnes inconnues : le texte seul, lu par le modèle choisi (Sonnet par défaut) ;
// - PDF scanné (sans texte) : le document lui-même, lu comme une image, quelques pages à la fois.
// À l'enregistrement :
// un vin déjà connu (même clé) garde son prix imposé et son rattachement choisi par Pat ; un vin absent du tarif n'est plus proposé.
// Sans « server-only » : lancé en arrière-plan par le serveur.
import { randomUUID } from 'node:crypto';
import type { Requete } from '../generation/accords';
import { clientClaude, modeleLecture } from '../claude';
import { pdfSansTexte, tableauCsv, tableauExcel, tableauJson, textePdf, texteDuTableau, vinsDuTableau, type Tableau } from './sources';
import { producteurConnu } from '../inscription/lecture';
import { cleVin, dedoublonner, vinTarif, type VinTarif } from './tarif';
import { rattacherCuvees } from './rattachement';
import { etiquettesDuCollage } from './etiquettes';

const PAGES_PAR_LECTURE = 4;
const LECTURES_EN_PARALLELE = 3;
const PAGES_MAX = 80;
const FIN = 'PAS_DE_PAGE';

/** Modèle choisi pour ce distributeur : Sonnet par défaut, Haiku (le moins cher) ou Opus (le plus précis). */
export type ModeleTarif = 'sonnet' | 'haiku' | 'opus';
export const modeleTarif = (choix: string | null | undefined) =>
  choix === 'haiku' ? 'claude-haiku-5-5' : choix === 'opus' ? modeleLecture() : process.env.PAT_MODELE_TARIF || 'claude-sonnet-5-5';
const NOMS_MODELES: Record<ModeleTarif, string> = { sonnet: 'Claude Sonnet', haiku: 'Claude Haiku', opus: 'Claude Opus' };

const consigne = (de: number, a: number) => `Ce document est le tarif d'un distributeur de vin (prix HTVA à la bouteille).
Relève UNIQUEMENT les vins des pages ${de} à ${a} du document (numérotation du fichier, la première page est la page 1).
Si le document n'a pas de page ${de}, réponds exactement ${FIN}, sans rien d'autre.
${CHAMPS}`;

/** Consigne pour un extrait de texte (PDF, tableau ou réponse d'API) : mêmes champs. */
const consigneTexte = (texte: string) => `Voici un extrait du tarif d'un distributeur de vin (prix HTVA à la bouteille), en texte :
les lignes du document, les colonnes séparées par des tabulations, « --- page N --- » au début de chaque page.

${texte}

Relève chaque vin de cet extrait. ${CHAMPS}`;

const CHAMPS = `Pour chaque ligne de vin : « producteur » (domaine, château ou maison : le titre du domaine au-dessus des vins, ou le nom après le tiret
dans une liste, ou le nom écrit dans l'intitulé — « PROSECCO CREDE 2023 BISOL » donne « Bisol », « FERRARI PERLE 2018 » donne « Ferrari » ;
sans le village ni la mention entre parenthèses — « Domaine Clotilde Davenne à Préhy (RAI) » donne « Domaine Clotilde Davenne » ;
null s'il n'est pas indiqué), « vin » (appellation et cuvée, sans millésime, sans contenance, sans le producteur, sans date de dégorgement
comme « - 03/26 » ; un intitulé tout en majuscules est remis en minuscules avec les majuscules d'usage : « Prosecco Crede »),
« millesime » (4 chiffres, ou null), « contenance » (en cl, ex. « 37,5 cl », « 150 cl » ; « 0,75 » ou « 75 cl » : null ; « 1,5 » ou « 1.5L » : « 150 cl » ; « 3L » : « 300 cl »),
« prix » (nombre : le prix de la ligne ; quand une ligne donne deux prix, un prix barré puis un prix remisé, c'est le plus bas),
« prix_catalogue » (le plus haut des deux prix quand il y en a deux, sinon null), « reference » (le code de l'article s'il est indiqué,
ex. « SPFER200 », sinon null), « epuise » (true si la ligne dit épuisé), « max » (le nombre de « Max. N », ou null),
« couleur » parmi bulles, blanc, rose, rouge, doux, orange (selon le nom ou l'appellation ; null si impossible à savoir),
« certification » (BIO, BIODY, RAI… indiqué pour le domaine, ou null), « section » (le titre de région ou de liste au-dessus, ou null).
Les lignes qui ne sont pas des vins (conditions de vente, légende, coordonnées, boutons du site) et les articles à 0,00 € sont ignorés.
N'invente rien. Réponds uniquement en JSON, sans texte autour : [{"producteur": "...", "vin": "...", "millesime": "2023", "contenance": null, "prix": 12.5,
"prix_catalogue": null, "reference": null, "epuise": false, "max": null, "couleur": "blanc", "certification": "BIO", "section": "Bourgogne"}] ([] s'il n'y a aucun vin).`;

function tableau(t: string): unknown[] | null {
  const debut = t.indexOf('['), fin = t.lastIndexOf(']');
  if (debut < 0 || fin < debut) return null;
  try { const v = JSON.parse(t.slice(debut, fin + 1)); return Array.isArray(v) ? v : null; } catch { return null; }
}

/** PDF scanné : le document lui-même, quelques pages par appel (Claude est plus précis), jusqu'à la dernière page. */
export async function lireVinsDuPdfImage(pdf: Buffer, modele: string): Promise<VinTarif[]> {
  const client = clientClaude({ maxRetries: 3 });
  // Le même document à chaque appel : gardé en cache chez Anthropic (moins cher dès le deuxième appel).
  const document = { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdf.toString('base64') },
    cache_control: { type: 'ephemeral' as const } };
  const lirePages = async (de: number): Promise<unknown[] | 'fin'> => {
    const m = await client.messages.stream({
      model: modele, max_tokens: 32000,
      messages: [{ role: 'user', content: [document, { type: 'text', text: consigne(de, de + PAGES_PAR_LECTURE - 1) }] }],
    }).finalMessage();
    const t = m.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    if (t.includes(FIN) && !/\[\s*\{/.test(t)) return 'fin';
    const v = tableau(t);
    if (!v) throw new Error(`réponse illisible pour les pages ${de} à ${de + PAGES_PAR_LECTURE - 1}`);
    return v;
  };
  // Les premières pages seules d’abord : le document est mis en cache pour les lectures suivantes, faites en parallèle.
  const premiere = await lirePages(1);
  if (premiere === 'fin') return [];
  const bruts: unknown[] = [...premiere];
  for (let de = 1 + PAGES_PAR_LECTURE; de <= PAGES_MAX; de += PAGES_PAR_LECTURE * LECTURES_EN_PARALLELE) {
    const lots = await Promise.all(Array.from({ length: LECTURES_EN_PARALLELE }, (_, i) => lirePages(de + i * PAGES_PAR_LECTURE)));
    let fini = false;
    for (const l of lots) { if (l === 'fin') fini = true; else bruts.push(...l); }
    if (fini) break;
  }
  return dedoublonner(bruts.map(vinTarif).filter((v): v is VinTarif => v !== null));
}

const CARACTERES_PAR_LECTURE = 14000; // quelques pages de tarif : une réponse courte et précise

/** Texte (pages d'un PDF, tableau, réponse d'API) lu par morceaux, trois à la fois. */
export async function lireVinsDuTexte(morceaux: string[], modele: string): Promise<VinTarif[]> {
  // Morceaux regroupés jusqu'à la taille d'une lecture (une page n'est jamais coupée, sauf si elle dépasse à elle seule).
  const lots: string[] = [];
  for (const m of morceaux.flatMap((x) => (x.length > CARACTERES_PAR_LECTURE ? x.match(new RegExp(`[^]{1,${CARACTERES_PAR_LECTURE}}(?=\\n|$)`, 'g')) ?? [x] : [x]))) {
    if (lots.length && lots[lots.length - 1].length + m.length < CARACTERES_PAR_LECTURE) lots[lots.length - 1] += `\n${m}`; else lots.push(m);
  }
  const client = clientClaude({ maxRetries: 3 });
  const lire = async (texte: string) => {
    const m = await client.messages.stream({ model: modele, max_tokens: 32000, messages: [{ role: 'user', content: consigneTexte(texte) }] }).finalMessage();
    const v = tableau(m.content.map((b) => (b.type === 'text' ? b.text : '')).join(''));
    if (!v) throw new Error('réponse illisible pour un extrait du tarif');
    return v;
  };
  const bruts: unknown[] = [];
  for (let i = 0; i < lots.length; i += LECTURES_EN_PARALLELE) bruts.push(...(await Promise.all(lots.slice(i, i + LECTURES_EN_PARALLELE).map(lire))).flat());
  return dedoublonner(bruts.map(vinTarif).filter((v): v is VinTarif => v !== null));
}

/** Tableau : colonnes reconnues (sans IA), sinon son texte lu par le modèle. */
async function lireTableau(t: Tableau, modele: ModeleTarif) {
  const direct = vinsDuTableau(t);
  if (direct) return { vins: dedoublonner(direct), methode: 'colonnes reconnues, sans IA' };
  const lignes = texteDuTableau(t).split('\n');
  const morceaux: string[] = [];
  for (let i = 0; i < lignes.length; i += 150) morceaux.push([lignes[0], ...lignes.slice(Math.max(i, 1), i + 150)].join('\n')); // titres répétés
  return { vins: await lireVinsDuTexte(morceaux, modeleTarif(modele)), methode: `${NOMS_MODELES[modele]} (colonnes non reconnues)` };
}

/** Un fichier de tarif (PDF, Excel ou CSV), lu par la méthode la moins chère qui convient. */
export async function lireFichierTarif(octets: Uint8Array, type: string, nom: string, modele: ModeleTarif) {
  if (type === 'application/pdf') {
    const pages = await textePdf(octets);
    if (pdfSansTexte(pages)) return { vins: await lireVinsDuPdfImage(Buffer.from(octets), modeleTarif(modele)), methode: `${NOMS_MODELES[modele]} (PDF scanné, lu comme une image)` };
    return { vins: await lireVinsDuTexte(pages.map((p, i) => `--- page ${i + 1} ---\n${p}`), modeleTarif(modele)), methode: `${NOMS_MODELES[modele]} (texte du PDF)` };
  }
  // Texte collé depuis le site du distributeur : lu par morceaux de 120 lignes environ (une ligne vide ne coupe jamais un article en deux).
  if (type === 'text/plain') {
    const blocs = Buffer.from(octets).toString('utf8').split(/\n\s*\n/);
    const morceaux: string[] = [];
    for (const b of blocs) {
      if (morceaux.length && morceaux[morceaux.length - 1].split('\n').length < 120) morceaux[morceaux.length - 1] += `\n\n${b}`; else morceaux.push(b);
    }
    return { vins: await lireVinsDuTexte(morceaux, modeleTarif(modele)), methode: `${NOMS_MODELES[modele]} (texte collé)` };
  }
  if (/\.csv$/i.test(nom) || type === 'text/csv') return lireTableau(tableauCsv(Buffer.from(octets).toString('utf8').replace(/^\uFEFF/, '')), modele);
  return lireTableau(await tableauExcel(octets), modele);
}

/** Tarif fourni par l'API du distributeur : JSON, CSV, Excel ou PDF. */
export async function lireApiTarif(url: string, entete: string | null, cle: string | null, modele: ModeleTarif) {
  if (!/^https:\/\//i.test(url)) throw new Error('l’adresse de l’API doit commencer par https://');
  const r = await fetch(url, { headers: { accept: 'application/json, text/csv, */*', ...(entete && cle ? { [entete]: cle } : {}) }, signal: AbortSignal.timeout(60_000) })
    .catch((e: Error) => { throw new Error(e.name === 'TimeoutError' ? 'l’API ne répond pas (plus d’une minute)' : 'l’API est injoignable : vérifiez son adresse'); });
  if (!r.ok) throw new Error(`l’API a répondu ${r.status}${r.status === 401 || r.status === 403 ? ' (accès refusé : vérifiez la clé)' : ''}`);
  const type = (r.headers.get('content-type') ?? '').split(';')[0].trim();
  const octets = new Uint8Array(await r.arrayBuffer());
  if (octets.length > 30 * 1024 * 1024) throw new Error('réponse de l’API trop lourde');
  if (/json/.test(type) || /^\s*[[{]/.test(Buffer.from(octets.subarray(0, 50)).toString('utf8'))) {
    const donnees = JSON.parse(Buffer.from(octets).toString('utf8'));
    const t = tableauJson(donnees);
    if (t) return lireTableau(t, modele);
    const texte = JSON.stringify(donnees, null, 1);
    const morceaux = texte.match(new RegExp(`[^]{1,${CARACTERES_PAR_LECTURE}}`, 'g')) ?? [];
    return { vins: await lireVinsDuTexte(morceaux, modeleTarif(modele)), methode: `${NOMS_MODELES[modele]} (réponse de l’API)` };
  }
  return lireFichierTarif(octets, type === 'application/pdf' || Buffer.from(octets.subarray(0, 4)).toString() === '%PDF' ? 'application/pdf' : type, /csv/.test(type) ? 'api.csv' : 'api.xlsx', modele);
}

/**
 * Enregistre les vins lus : nouveaux vins ajoutés, vins connus mis à jour (prix, disponibilité), vins absents du tarif
 * retirés de la proposition (gardés pour les anciennes commandes). Le producteur de la base de Pat est retrouvé par son nom,
 * sauf s'il a été choisi à la main. Renvoie les compteurs.
 */
export async function enregistrerVinsDuTarif(requete: Requete, distributeurId: string, vins: VinTarif[]) {
  // Producteurs choisis à la main par Pat pour ce distributeur (par le nom écrit sur le tarif) : repris pour les nouveaux vins.
  const choisis = new Map((await requete<{ nom: string; producteur_id: string | null; manuel: boolean }>(
    `select distinct on (producteur_texte) producteur_texte as nom, producteur_id, producteur_manuel as manuel from distributeur_vin
      where distributeur_id = $1 and producteur_texte is not null and producteur_manuel order by producteur_texte, maj_le desc`, [distributeurId])).map((c) => [c.nom, c.producteur_id]));
  const producteurs = new Map<string, string | null>();
  for (const nom of new Set(vins.map((v) => v.producteur).filter((p): p is string => Boolean(p)))) {
    producteurs.set(nom, choisis.has(nom) ? choisis.get(nom)! : (await producteurConnu(requete, nom))?.id ?? null);
  }
  const lignes = vins.map((v, i) => ({ ...v, cle: cleVin(v), ordre: i, producteur_id: v.producteur ? producteurs.get(v.producteur) ?? null : null,
    manuel: Boolean(v.producteur && choisis.has(v.producteur)) }));
  const uniques = [...new Map(lignes.map((l) => [l.cle, l])).values()];
  const avant = new Set((await requete<{ cle: string }>('select cle from distributeur_vin where distributeur_id = $1 and actif', [distributeurId])).map((r) => r.cle));
  const col = <K extends keyof (typeof uniques)[number]>(k: K) => uniques.map((l) => l[k]);
  await requete(
    `insert into distributeur_vin (id, distributeur_id, cle, section, producteur_texte, libelle, millesime, contenance, couleur, certification,
                                   prix_qv, epuise, maximum, producteur_id, ordre, producteur_manuel, reference, prix_catalogue)
     select x.id, $1, x.cle, x.section, x.producteur, x.libelle, x.millesime, x.contenance, x.couleur, x.certification, x.prix, x.epuise, x.maximum, x.producteur_id, x.ordre, x.manuel,
            x.reference, x.prix_catalogue
       from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::numeric[], $12::bool[], $13::int[], $14::text[], $15::int[], $16::bool[],
                   $17::text[], $18::numeric[])
            as x(id, cle, section, producteur, libelle, millesime, contenance, couleur, certification, prix, epuise, maximum, producteur_id, ordre, manuel, reference, prix_catalogue)
     on conflict (distributeur_id, cle) do update set section = excluded.section, producteur_texte = excluded.producteur_texte, libelle = excluded.libelle,
       millesime = excluded.millesime, contenance = excluded.contenance, couleur = coalesce(excluded.couleur, distributeur_vin.couleur),
       certification = excluded.certification, prix_qv = excluded.prix_qv, reference = excluded.reference, prix_catalogue = excluded.prix_catalogue, epuise = excluded.epuise, maximum = excluded.maximum, ordre = excluded.ordre,
       producteur_id = case when distributeur_vin.producteur_manuel then distributeur_vin.producteur_id else excluded.producteur_id end,
       actif = true, maj_le = now()`,
    [distributeurId, uniques.map(() => randomUUID()), col('cle'), col('section'), col('producteur'), col('libelle'), col('millesime'), col('contenance'),
      col('couleur'), col('certification'), col('prix'), col('epuise'), col('maximum'), col('producteur_id'), col('ordre'), col('manuel'),
      uniques.map((l) => l.reference ?? null), uniques.map((l) => l.prixCatalogue ?? null)]);
  const retires = await requete<{ id: string }>(
    `update distributeur_vin set actif = false, maj_le = now() where distributeur_id = $1 and actif and not (cle = any($2)) returning id`,
    [distributeurId, col('cle')]);
  await rattacherCuvees(requete, distributeurId);
  return { lus: uniques.length, nouveaux: uniques.filter((l) => !avant.has(l.cle)).length, retires: retires.length,
    rattaches: uniques.filter((l) => l.producteur_id).length };
}

/** Lecture du tarif (dernier fichier déposé, ou API du distributeur), en arrière-plan : l'avancement est gardé sur le distributeur. */
export async function lireTarif(requete: Requete, distributeurId: string, depuis: 'fichier' | 'api' = 'fichier') {
  const etat = (statut: string, message: string) =>
    requete('update distributeur set lecture_statut = $2, lecture_message = $3, lecture_le = now() where id = $1', [distributeurId, statut, message]);
  try {
    const [d] = await requete<{ modele_lecture: ModeleTarif; api_url: string | null; api_entete: string | null; api_cle: string | null }>(
      'select modele_lecture, api_url, api_entete, api_cle from distributeur where id = $1', [distributeurId]);
    if (!d) return;
    let lu: { vins: VinTarif[]; methode: string }, source: string, html: string | null = null;
    if (depuis === 'api') {
      if (!d.api_url) { await etat('echec', 'Aucune adresse d’API enregistrée.'); return; }
      await etat('en_cours', 'Lecture du tarif depuis l’API du distributeur…');
      lu = await lireApiTarif(d.api_url, d.api_entete, d.api_cle, d.modele_lecture);
      source = 'l’API du distributeur';
      await requete('update distributeur set api_synchro_le = now() where id = $1', [distributeurId]);
    } else {
      const [t] = await requete<{ octets: Buffer; nom: string; media_type: string; html: string | null }>(
        'select octets, nom, media_type, html from distributeur_tarif where distributeur_id = $1 order by cree_le desc limit 1', [distributeurId]);
      if (!t) { await etat('echec', 'Aucun tarif déposé.'); return; }
      await etat('en_cours', `Lecture de « ${t.nom} »…`);
      lu = await lireFichierTarif(new Uint8Array(t.octets), t.media_type, t.nom, d.modele_lecture);
      source = `« ${t.nom} »`;
      html = t.html;
    }
    if (!lu.vins.length) { await etat('echec', `Aucun vin trouvé dans ${source}.`); return; }
    const n = await enregistrerVinsDuTarif(requete, distributeurId, lu.vins);
    const fin = `${n.lus} vins lus dans ${source} (${lu.methode}) : ${n.nouveaux} nouveaux, ${n.retires} retirés, ${n.rattaches} rattachés à un producteur de la base.`;
    if (html) {
      await etat('en_cours', `${fin} Copie des étiquettes…`);
      const e = await etiquettesDuCollage(requete, distributeurId, html);
      await etat('terminee', `${fin} ${e.trouvees ? `${e.copiees} étiquette${e.copiees > 1 ? 's' : ''} copiée${e.copiees > 1 ? 's' : ''} sur ${e.trouvees} trouvée${e.trouvees > 1 ? 's' : ''}${e.copiees < e.trouvees ? ' (les autres ne sont pas accessibles sans être connecté au site)' : ''}.` : 'Aucune étiquette trouvée dans le collage.'}`);
    } else await etat('terminee', fin);
  } catch (e) {
    console.error('[tarif]', distributeurId, e);
    await etat('echec', `La lecture n’a pas abouti : ${(e as Error).message}`.slice(0, 500));
  }
}
