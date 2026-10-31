// Vins d'un distributeur ajoutés à la base de Pat (à valider) : cépages et appellation cherchés par Claude sur le site public
// du distributeur (recherche et lecture de pages limitées à son domaine), puis enregistrés sans rien écraser.
// Sans « server-only » : lancé en arrière-plan.
import Anthropic from '@anthropic-ai/sdk';
import type { Requete } from '../generation/accords';
import { appellationCourte } from '../admin/intitule';
import { clientClaude } from '../claude';
import { creerAppellationProposeeAvec } from '../appellations/creation';
import { cleAppellation } from '../appellations/regroupement';
import { extraireVins, modeleTarif, type ModeleTarif } from './lecture';

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

const LOT = 6;
const EN_PARALLELE = 3;

const consigne = (distributeur: string, domaine: string | null, vins: Array<{ id: string; producteur: string; nom: string; millesime: string | null }>) =>
  `Tu complètes la base de vins d'un sommelier. Pour chacun de ces vins, vendus par le distributeur ${distributeur}${domaine ? ` (site public : ${domaine})` : ''},
trouve l'appellation et les cépages${domaine ? ` sur le site de ${distributeur} (cherche avec web_search, ouvre les pages produits avec web_fetch)` : ' (cherche avec web_search)'}.

${vins.map((v) => `- id ${v.id} : ${v.producteur} — ${v.nom}${v.millesime ? ` ${v.millesime}` : ''}`).join('\n')}

Pour chaque vin : « appellation » (le nom officiel, sans « AOC », « DOC »… à la fin, ex. « Trento », « Barolo », « Franciacorta » ; null si introuvable)
et « cepages » (les cépages tels qu'indiqués, ex. « Chardonnay 80%, Pinot Noir 20% » ; null si introuvable). N'invente rien : en cas de doute, null.
Réponds uniquement en JSON, sans texte autour : {"vins": [{"id": "...", "appellation": "...", "cepages": "..."}]}`;

/** Recherche pour un lot de vins (outils de recherche web côté serveur, avec reprise des tours mis en pause). */
async function chercherLot(client: Anthropic, modele: string, texte: string, domaine: string | null) {
  const outils = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 8, ...(domaine ? { allowed_domains: [domaine] } : {}) },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 12, ...(domaine ? { allowed_domains: [domaine] } : {}) },
  ];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: texte }];
  for (let tour = 0; tour < 4; tour++) {
    const m = await client.messages.stream({ model: modele, max_tokens: 16000, messages, tools: outils } as unknown as Anthropic.MessageStreamParams).finalMessage();
    if ((m.stop_reason as string) !== 'pause_turn') return m.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    messages.push({ role: 'assistant', content: m.content as unknown as Anthropic.ContentBlockParam[] }); // reprise du tour en pause
  }
  return '';
}

/**
 * Cuvées à valider des vins de ce distributeur, sans cépages ou sans appellation : cherchées sur le site du distributeur, par lots.
 * Les cépages et l'appellation trouvés complètent la cuvée (jamais à la place de ce qui est déjà écrit) ; l'appellation est
 * reliée à celle de la base de même nom, sinon ajoutée à valider. L'avancement est gardé sur le distributeur.
 */
export async function completerVinsDistributeur(requete: Requete, distributeurId: string) {
  const etat = (statut: string, message: string) =>
    requete('update distributeur set completion_statut = $2, completion_message = $3, completion_le = now() where id = $1', [distributeurId, statut, message]);
  try {
    const [d] = await requete<{ nom: string; site: string | null; modele_lecture: ModeleTarif }>('select nom, site, modele_lecture from distributeur where id = $1', [distributeurId]);
    if (!d) return;
    const domaine = domaineDuSite(d.site);
    const vins = await requete<{ id: string; producteur: string; nom: string; millesime: string | null }>(
      `select distinct on (c.id) c.id, p.nom as producteur, c.nom, v.millesime
         from cuvee c join producteur p on p.id = c.producteur_id join distributeur_vin v on v.cuvee_id = c.id and v.distributeur_id = $1 and v.actif
        where c.statut = 'propose' and (coalesce(c.cepages, '') = '' or (c.appellation_id is null and coalesce(c.appellation_texte, '') = ''))
        order by c.id, v.ordre`, [distributeurId]);
    if (!vins.length) { await etat('terminee', 'Tous les vins à valider ont déjà leurs cépages et leur appellation.'); return; }
    const client = clientClaude({ maxRetries: 3 });
    const modele = modeleTarif(d.modele_lecture);
    const terroirs = await requete<{ id: string; nom: string }>(`select id, nom from terroir where statut <> 'retire'`);
    let cepages = 0, appellations = 0, faits = 0;
    const lots: typeof vins[] = [];
    for (let i = 0; i < vins.length; i += LOT) lots.push(vins.slice(i, i + LOT));
    const traiter = async (lot: typeof vins) => {
      const reponse = extraireVins(await chercherLot(client, modele, consigne(d.nom, domaine, lot), domaine).catch((e) => { console.error('[completer]', e); return ''; })) ?? [];
      for (const r of reponse as Array<{ id?: string; appellation?: string | null; cepages?: string | null }>) {
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
      }
      faits += lot.length;
      await etat('en_cours', `Recherche sur ${domaine ?? 'le web'} : ${faits} vins sur ${vins.length}…`);
    };
    await etat('en_cours', `Recherche sur ${domaine ?? 'le web'} : 0 vin sur ${vins.length}…`);
    for (let i = 0; i < lots.length; i += EN_PARALLELE) await Promise.all(lots.slice(i, i + EN_PARALLELE).map(traiter));
    await etat('terminee', `${vins.length} vins cherchés sur ${domaine ?? 'le web'} : ${cepages} reçoivent leurs cépages, ${appellations} leur appellation.`);
  } catch (e) {
    console.error('[completer]', distributeurId, e);
    await etat('echec', `La recherche n’a pas abouti : ${(e as Error).message}`.slice(0, 500));
  }
}
