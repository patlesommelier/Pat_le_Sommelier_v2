// Vins d'un distributeur ajoutés à la base de Pat (à valider) : cépages, appellation et photo cherchés par Claude sur le site public
// du distributeur (recherche et lecture de pages limitées à son domaine), puis enregistrés sans rien écraser.
// Sans « server-only » : lancé en arrière-plan.
import Anthropic from '@anthropic-ai/sdk';
import type { Requete } from '../generation/accords';
import { appellationCourte } from '../admin/intitule';
import { clientClaude } from '../claude';
import { creerAppellationProposeeAvec } from '../appellations/creation';
import { cleAppellation } from '../appellations/regroupement';
import { extraireVins, modeleTarif, type ModeleTarif } from './lecture';
import { garder, partagerEtiquettesDistributeur, telecharger } from './etiquettes';
import { recadrerSurEtiquette } from './recadrage';

/** Cépages remis en forme : sans pourcentages, en minuscules, séparés par des virgules (« Chardonnay 80 %, Pinot Noir 20% » → « chardonnay, pinot noir »). */
export function normaliserCepages(texte: string | null | undefined): string | null {
  if (!texte) return null;
  const cepages = texte.toLowerCase()
    .replace(/\(?\s*\d+(?:[.,]\d+)?\s*%\s*\)?/g, ' ')
    .split(/\s*(?:[,;\/+&]|\bet\b|\be\b|\band\b|\ben\b|\bund\b)\s*/)
    .map((c) => c.replace(/[()]/g, '').replace(/\s+/g, ' ').trim())
    .filter((c) => c && !/^\d+$/.test(c));
  return cepages.length ? [...new Set(cepages)].join(', ') : null;
}

/** Domaine du site du distributeur (« https://www.licata.be/fr » → « licata.be ») ; null s'il n'est pas renseigné. */
export function domaineDuSite(site: string | null | undefined): string | null {
  if (!site?.trim()) return null;
  try { return new URL(/^https?:\/\//i.test(site.trim()) ? site.trim() : `https://${site.trim()}`).hostname.replace(/^www\./, ''); } catch { return null; }
}

/**
 * Photo trouvée sur le web : téléchargée, vérifiée (une vraie image, pas une icône), recadrée sur l'étiquette si c'est une photo
 * de bouteille, puis gardée chez nous. null si elle n'est pas accessible ou n'en est pas une.
 */
async function etiquetteDepuisPhoto(client: Anthropic, modele: string, url: string, nom: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const contenu = await telecharger(url);
  if (!contenu || contenu.octets.length < 3000) return null; // trop petite : icône, logo ou pixel
  const r = await recadrerSurEtiquette(client, modele, contenu.octets, contenu.type);
  if (r.resultat === 'aucune' || r.resultat === 'petite') return null; // pas d'étiquette lisible sur cette photo
  return garder(r.octets, r.type, nom).catch(() => null);
}

const LOT = 6;
const EN_PARALLELE = 3;

const consigne = (distributeur: string, domaine: string | null, vins: Array<{ id: string; producteur: string; nom: string; millesime: string | null; sans_photo: boolean }>) =>
  `Tu complètes la base de vins d'un sommelier. Pour chacun de ces vins, vendus par le distributeur ${distributeur}${domaine ? ` (site public : ${domaine})` : ''},
trouve l'appellation, les cépages et, pour ceux marqués « photo à trouver », la photo de la bouteille${domaine ? ` sur le site de ${distributeur} (cherche avec web_search, ouvre les pages produits avec web_fetch)` : ' (cherche avec web_search)'}.

${vins.map((v) => `- id ${v.id} : ${v.producteur} — ${v.nom}${v.millesime ? ` ${v.millesime}` : ''}${v.sans_photo ? ' (photo à trouver)' : ''}`).join('\n')}

Pour chaque vin : « appellation » (le nom officiel, sans « AOC », « DOC »… à la fin, ex. « Trento », « Barolo », « Franciacorta » ; null si introuvable)
, « cepages » (les cépages tels qu'indiqués, ex. « Chardonnay 80%, Pinot Noir 20% » ; null si introuvable)
et « image » (seulement pour un vin marqué « photo à trouver » : l'adresse complète, telle qu'elle figure sur la page du vin, de l'image
de son étiquette — de préférence l'étiquette seule, sinon la photo de la bouteille de face, étiquette lisible ; pas un logo, une bannière
ni la photo d'un autre vin ; null sinon). N'invente rien : en cas de doute, null.
Réponds uniquement en JSON, sans texte autour : {"vins": [{"id": "...", "appellation": "...", "cepages": "...", "image": null}]}`;

/** Recherche pour un lot de vins (outils de recherche web côté serveur, avec reprise des tours mis en pause). */
async function chercherLot(client: Anthropic, modele: string, texte: string, domaine: string | null) {
  const outils = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 8, ...(domaine ? { allowed_domains: [domaine] } : {}) },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 12, ...(domaine ? { allowed_domains: [domaine] } : {}) },
  ];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: texte }];
  for (let tour = 0; tour < 4; tour++) {
    // Quatre minutes au plus par appel : un appel qui ne répond plus ne bloque pas toute la recherche.
    const m = await client.messages.stream({ model: modele, max_tokens: 16000, messages, tools: outils } as unknown as Anthropic.MessageStreamParams,
      { timeout: 4 * 60_000 }).finalMessage();
    if ((m.stop_reason as string) !== 'pause_turn') return m.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    messages.push({ role: 'assistant', content: m.content as unknown as Anthropic.ContentBlockParam[] }); // reprise du tour en pause
  }
  return '';
}

/**
 * Vins de la base (à valider ou validés) de ce distributeur, sans cépages, sans appellation ou sans photo : cherchés sur le site du distributeur,
 * par lots. Relancée, la recherche reprend là où elle s'était arrêtée (seuls les vins encore incomplets sont cherchés).
 * Les cépages et l'appellation trouvés complètent la cuvée (jamais à la place de ce qui est déjà écrit) ; l'appellation est
 * reliée à celle de la base de même nom, sinon ajoutée à valider. L'avancement est gardé sur le distributeur.
 */
export async function completerVinsDistributeur(requete: Requete, distributeurId: string, { aussiDejaCherches = false } = {}) {
  const etat = (statut: string, message: string) =>
    requete('update distributeur set completion_statut = $2, completion_message = $3, completion_le = now() where id = $1', [distributeurId, statut, message]);
  try {
    const [d] = await requete<{ nom: string; site: string | null; modele_lecture: ModeleTarif }>('select nom, site, modele_lecture from distributeur where id = $1', [distributeurId]);
    if (!d) return;
    const domaine = domaineDuSite(d.site);
    // Une cuvée sans photo : ni la sienne, ni une étiquette déjà copiée du distributeur (collage, document Word).
    const vins = await requete<{ id: string; producteur: string; nom: string; millesime: string | null; sans_photo: boolean }>(
      `select distinct on (c.id) c.id, p.nom as producteur, c.nom, v.millesime,
              c.etiquette_url is null and not exists (select 1 from distributeur_vin e where e.cuvee_id = c.id and e.etiquette_url is not null) as sans_photo
         from cuvee c join producteur p on p.id = c.producteur_id join distributeur_vin v on v.cuvee_id = c.id and v.distributeur_id = $1 and v.actif
        where c.statut <> 'retire' and (coalesce(c.cepages, '') = '' or (c.appellation_id is null and coalesce(c.appellation_texte, '') = '')
              or (c.etiquette_url is null and not exists (select 1 from distributeur_vin e where e.cuvee_id = c.id and e.etiquette_url is not null)))
          and ($2 or not exists (select 1 from distributeur_vin x where x.cuvee_id = c.id and x.distributeur_id = $1 and x.cherche_le is not null))
        order by c.id, v.ordre`, [distributeurId, aussiDejaCherches]);
    if (!vins.length) { await etat('terminee', 'Aucun vin à chercher : les vins incomplets ont déjà été cherchés (cochez « aussi ceux déjà cherchés » pour recommencer).'); return; }
    const client = clientClaude({ maxRetries: 1 });
    const modele = modeleTarif(d.modele_lecture);
    const terroirs = await requete<{ id: string; nom: string }>(`select id, nom from terroir where statut <> 'retire'`);
    let cepages = 0, appellations = 0, photos = 0, faits = 0, erreurs = 0, derniereErreur = '';
    const lots: typeof vins[] = [];
    for (let i = 0; i < vins.length; i += LOT) lots.push(vins.slice(i, i + LOT));
    const traiter = async (lot: typeof vins) => {
      // Appel en erreur (Claude injoignable…) : le lot n'est pas marqué « cherché », une reprise le refera.
      let texte: string;
      try { texte = await chercherLot(client, modele, consigne(d.nom, domaine, lot), domaine); } catch (e) {
        console.error('[completer]', e);
        erreurs += lot.length; faits += lot.length;
        derniereErreur = (e as Error).message;
        return;
      }
      const reponse = extraireVins(texte) ?? [];
      for (const r of reponse as Array<{ id?: string; appellation?: string | null; cepages?: string | null; image?: string | null }>) {
        const v = lot.find((x) => x.id === r.id);
        if (!v) continue;
        const c = normaliserCepages(r.cepages);
        if (c) {
          const n = await requete(`update cuvee set cepages = $2 where id = $1 and coalesce(cepages, '') = '' returning id`, [v.id, c]);
          cepages += n.length;
        }
        const a = r.appellation?.trim() ? appellationCourte(r.appellation.trim()) : null;
        if (a) {
          const terroir = terroirs.find((t) => cleAppellation(t.nom) === cleAppellation(a))?.id ?? await creerAppellationProposeeAvec(requete, a, 'distributeur');
          const n = await requete(`update cuvee set appellation_texte = $2, appellation_id = $3 where id = $1 and appellation_id is null and coalesce(appellation_texte, '') = '' returning id`,
            [v.id, a, terroir]);
          appellations += n.length;
        }
        // Photo : copiée chez nous, sur les vins du distributeur sans étiquette, puis donnée à la cuvée (si elle n'en a toujours pas).
        if (v.sans_photo && r.image?.trim()) {
          const url = await etiquetteDepuisPhoto(client, modele, r.image.trim(), `${distributeurId.slice(0, 8)}-${v.id.slice(-40).replace(/[^a-z0-9]+/gi, '-')}`);
          if (url) {
            await requete('update distributeur_vin set etiquette_url = $3, image_source = $4, etiquette_recadree = true where distributeur_id = $1 and cuvee_id = $2 and etiquette_url is null',
              [distributeurId, v.id, url, r.image.trim()]);
            photos++;
          }
        }
      }
      // Vins du lot marqués « cherchés » (trouvés ou non) : une reprise passe aux suivants.
      await requete('update distributeur_vin set cherche_le = now() where distributeur_id = $1 and cuvee_id = any($2)', [distributeurId, lot.map((v) => v.id)]);
      faits += lot.length;
      await etat('en_cours', `Recherche sur ${domaine ?? 'le web'} : ${faits} vins sur ${vins.length}…`);
    };
    await etat('en_cours', `Recherche sur ${domaine ?? 'le web'} : 0 vin sur ${vins.length}…`);
    for (let i = 0; i < lots.length; i += EN_PARALLELE) await Promise.all(lots.slice(i, i + EN_PARALLELE).map(traiter));
    await partagerEtiquettesDistributeur(requete, distributeurId);
    if (erreurs === vins.length) { await etat('echec', `La recherche n’a pas abouti (${derniereErreur}) : relancez-la plus tard.`.slice(0, 500)); return; }
    await etat('terminee', `${vins.length - erreurs} vins cherchés sur ${domaine ?? 'le web'} : ${cepages} reçoivent leurs cépages, ${appellations} leur appellation, ${photos} leur photo.`
      + (erreurs ? ` ${erreurs} n’ont pas pu être cherchés (erreur de connexion) : relancez la recherche pour eux.` : ''));
  } catch (e) {
    console.error('[completer]', distributeurId, e);
    await etat('echec', `La recherche n’a pas abouti : ${(e as Error).message}`.slice(0, 500));
  }
}

// ───────── Photos déjà gardées : recadrées sur l'étiquette ─────────
/**
 * Photos des vins de ce distributeur pas encore recadrées (collage, document Word, recherches précédentes) : chaque photo de bouteille
 * est remplacée par son étiquette, chez le distributeur et dans la base de Pat (si la photo du vin de la base venait de là).
 */
export async function recadrerPhotosDistributeur(requete: Requete, distributeurId: string) {
  const etat = (statut: string, message: string) =>
    requete('update distributeur set completion_statut = $2, completion_message = $3, completion_le = now() where id = $1', [distributeurId, statut, message]);
  try {
    const [d] = await requete<{ modele_lecture: ModeleTarif }>('select modele_lecture from distributeur where id = $1', [distributeurId]);
    if (!d) return;
    const photos = (await requete<{ url: string }>(
      `select distinct etiquette_url as url from distributeur_vin where distributeur_id = $1 and actif and etiquette_url is not null and not etiquette_recadree`, [distributeurId])).map((p) => p.url);
    if (!photos.length) { await etat('terminee', 'Toutes les photos de ce distributeur sont déjà recadrées sur l’étiquette.'); return; }
    const client = clientClaude({ maxRetries: 1 });
    const modele = modeleTarif(d.modele_lecture);
    let recadrees = 0, deja = 0, illisibles = 0, faites = 0;
    const traiter = async (ancienne: string, i: number) => {
      const contenu = await telecharger(ancienne);
      const r = contenu ? await recadrerSurEtiquette(client, modele, contenu.octets, contenu.type) : null;
      if (r?.resultat === 'recadree') {
        const nouvelle = await garder(r.octets, r.type, `${distributeurId.slice(0, 8)}-etiquette-${i}`);
        if (nouvelle) {
          await requete(`update distributeur_vin set etiquette_url = $3, etiquette_recadree = true, etiquette_qualite = 'etiquette' where distributeur_id = $1 and etiquette_url = $2`, [distributeurId, ancienne, nouvelle]);
          await requete(`update cuvee set etiquette_url = $2, etiquette_maj_le = now() where etiquette_url = $1 and etiquette_source = 'distributeur'`, [ancienne, nouvelle]);
          recadrees++;
        }
      } else if (r && r.resultat !== 'echec') {
        // Déjà l'étiquette, vignette trop petite, ou pas d'étiquette lisible : gardée telle quelle (les deux dernières seront à remplacer).
        const qualite = r.resultat === 'deja' ? 'etiquette' : r.resultat === 'petite' ? 'petite' : 'illisible';
        await requete('update distributeur_vin set etiquette_recadree = true, etiquette_qualite = $3 where distributeur_id = $1 and etiquette_url = $2', [distributeurId, ancienne, qualite]);
        if (qualite === 'etiquette') deja++; else illisibles++;
      }
      faites++;
      if (faites % 8 === 0) await etat('en_cours', `Recadrage des photos : ${faites} sur ${photos.length}, ${recadrees} recadrées…`);
    };
    await etat('en_cours', `Recadrage des photos : 0 sur ${photos.length}…`);
    for (let i = 0; i < photos.length; i += 4) await Promise.all(photos.slice(i, i + 4).map((u, j) => traiter(u, i + j)));
    const aReessayer = photos.length - recadrees - deja - illisibles;
    await etat('terminee', `${photos.length} photos examinées : ${recadrees} recadrées sur l’étiquette, ${deja} déjà des étiquettes, ${illisibles} vignettes trop petites ou sans étiquette lisible (à chercher sur le web)`
      + (aReessayer ? `, ${aReessayer} à réessayer (relancez le recadrage)` : '') + '.');
  } catch (e) {
    console.error('[recadrage]', distributeurId, e);
    await etat('echec', `Le recadrage n’a pas abouti : ${(e as Error).message}`.slice(0, 500));
  }
}
