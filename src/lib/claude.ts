// Client Claude unique de l'application.
// La passerelle IA de Netlify (AI Gateway) injecte ANTHROPIC_BASE_URL dans les fonctions : sans précaution, les appels
// passent par elle et sont facturés en crédits Netlify, même avec la clé du compte Anthropic de Pat.
// On appelle donc toujours Anthropic directement ; PAT_ANTHROPIC_BASE_URL sert seulement aux essais locaux.
// Sans 'server-only' : aussi utilisé par les fonctions Netlify d'arrière-plan et les scripts.
import Anthropic from '@anthropic-ai/sdk';
import { AsyncLocalStorage } from 'node:async_hooks';

export const ADRESSE_CLAUDE = () => process.env.PAT_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

// ───────── Suivi de la consommation (table consommation_claude, page Consommation du super-admin) ─────────
/** Ce que fait l'appel (« lecture carte », « accords »…) et pour qui : restaurant, ou inscription pas encore finalisée. */
export interface ContexteSuivi { poste?: string; restaurant?: string | null; inscription?: string | null }
const SUIVI = new AsyncLocalStorage<ContexteSuivi>();
/** Exécute `f` en notant ses appels à Claude sous ce poste (et ce restaurant). */
export const avecSuivi = <T,>(contexte: ContexteSuivi, f: () => Promise<T>): Promise<T> => SUIVI.run({ ...SUIVI.getStore(), ...contexte }, f);

type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null; server_tool_use?: { web_search_requests?: number | null } | null };

/** Enregistre la consommation d'un appel ; jamais bloquant (sans base, dans un script ou un test : rien). */
function noter(modele: string, usage: Usage | undefined, defaut: ContexteSuivi = {}) {
  if (!usage || !process.env.DATABASE_URL) return;
  const c = { ...defaut, ...SUIVI.getStore() };
  import('./db').then(({ requete }) => requete(
    `insert into consommation_claude (poste, restaurant_id, inscription_id, modele, entree, sortie, cache_lu, cache_ecrit, recherches)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [c.poste ?? 'autre', c.restaurant ?? null, c.inscription ?? null, modele, usage.input_tokens ?? 0, usage.output_tokens ?? 0,
      usage.cache_read_input_tokens ?? 0, usage.cache_creation_input_tokens ?? 0, usage.server_tool_use?.web_search_requests ?? 0]))
    .catch(() => { /* le suivi ne doit jamais faire échouer un appel */ });
}

export function clientClaude({ suivi = {}, ...options }: { maxRetries?: number; suivi?: ContexteSuivi } = {}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: ADRESSE_CLAUDE(), ...options });
  // Chaque réponse (appel simple ou en flux) est notée avec son modèle et ses jetons.
  const creer = client.messages.create.bind(client.messages);
  client.messages.create = ((corps: Anthropic.MessageCreateParams, opts?: unknown) => {
    const r = creer(corps as never, opts as never);
    if (!corps.stream) (r as unknown as Promise<Anthropic.Message>).then((m) => noter(m.model, m.usage as Usage, suivi), () => {});
    return r;
  }) as typeof client.messages.create;
  const flux = client.messages.stream.bind(client.messages);
  client.messages.stream = ((corps: Anthropic.MessageStreamParams, opts?: unknown) => {
    const s = flux(corps, opts as never);
    s.finalMessage().then((m) => noter(m.model, m.usage as Usage, suivi), () => {});
    return s;
  }) as typeof client.messages.stream;
  return client;
}

/** Prix en dollars par million de jetons (entrée, sortie, lecture du cache) et par recherche web. */
export const PRIX_CLAUDE: Record<string, { entree: number; sortie: number; cacheLu: number }> = {
  opus: { entree: 4, sortie: 20, cacheLu: 0.2 }, sonnet: { entree: 2, sortie: 10, cacheLu: 0.2 }, haiku: { entree: 0.1, sortie: 0.5, cacheLu: 0.01 },
};
export const PRIX_RECHERCHE = 0.01;
/** Coût estimé d'une consommation (dollars) ; mise en cache comptée 1,25 × le prix d'entrée. */
export function coutClaude(modele: string, j: { entree: number; sortie: number; cache_lu: number; cache_ecrit: number; recherches: number }) {
  const p = PRIX_CLAUDE[/opus/.test(modele) ? 'opus' : /haiku/.test(modele) ? 'haiku' : 'sonnet'];
  return (j.entree * p.entree + j.sortie * p.sortie + j.cache_lu * p.cacheLu + j.cache_ecrit * p.entree * 1.25) / 1e6 + j.recherches * PRIX_RECHERCHE;
}

/** Pour le super-admin : comment Claude est branché (jamais la clé elle-même). */
export function etatClaude() {
  const cle = process.env.ANTHROPIC_API_KEY ?? '';
  return {
    adresse: ADRESSE_CLAUDE(),
    cle: !cle ? 'absente' : cle.startsWith('sk-ant-') ? 'clé du compte Anthropic' : 'clé fournie par Netlify (pas une clé sk-ant-)',
    passerelleNetlify: Boolean(process.env.ANTHROPIC_BASE_URL && !/api\.anthropic\.com/.test(process.env.ANTHROPIC_BASE_URL)),
  };
}

/**
 * Modèle des accords, commentaires, présentations et de la discussion avec Pat : Sonnet (deux fois moins cher qu'Opus),
 * décision de Pat. PAT_MODELE_ACCORDS permet de revenir à Opus sans modifier le code.
 * On ne lit plus ANTHROPIC_MODEL, souvent réglé sur Opus dans Netlify.
 */
export const modeleAccords = () => process.env.PAT_MODELE_ACCORDS || 'claude-sonnet-5-5';
/** Lecture des cartes et des menus à l'inscription : Opus, plus sûr pour lire des photos (PAT_MODELE_LECTURE pour changer). */
export const modeleLecture = () => process.env.PAT_MODELE_LECTURE || 'claude-opus-5-5';
