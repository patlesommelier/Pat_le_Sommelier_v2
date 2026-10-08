// Client Claude unique de l'application.
// La passerelle IA de Netlify (AI Gateway) injecte ANTHROPIC_BASE_URL dans les fonctions : sans précaution, les appels
// passent par elle et sont facturés en crédits Netlify, même avec la clé du compte Anthropic de Pat.
// On appelle donc toujours Anthropic directement ; PAT_ANTHROPIC_BASE_URL sert seulement aux essais locaux.
// Sans 'server-only' : aussi utilisé par les fonctions Netlify d'arrière-plan et les scripts.
import Anthropic from '@anthropic-ai/sdk';

export const ADRESSE_CLAUDE = () => process.env.PAT_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

export function clientClaude(options: { maxRetries?: number } = {}) {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: ADRESSE_CLAUDE(), ...options });
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
