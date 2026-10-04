/**
 * Présentation de chaque vin pour la carte des vins imprimée : 3 phrases, 3 à 4 lignes en A4.
 * Génération par Claude couleur par couleur (le modèle voit les autres vins de la couleur et varie),
 * contrôle automatique, puis régénération des textes refusés. Côté serveur uniquement.
 * Pas d'import « server-only » : utilisé aussi par le script `npm run presentations`.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { MOTS_INTERDITS as INTERDITS_ACCORDS } from './controle';

export const LONGUEUR_MIN = 230; // caractères : 3 lignes en A4
export const LONGUEUR_MAX = 380; // caractères : 4 lignes en A4

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, ' ');

/** Mots interdits des commentaires d'accord (avec leurs variantes), plus ce qui trahirait la cuisine interne. */
export const MOTS_INTERDITS: [string, RegExp][] = [...INTERDITS_ACCORDS, ['ranking', /\branking\w*/], ['score', /\bscores?\b/], ['note', /\bnote \d|\d\s*\/\s*5\b/]];

export interface VinPresentation {
  id: string; nom: string; producteur: string | null; millesime: string | null; couleur: string; region: string | null;
  cepages: string | null; descriptif: string | null; commentaires: string | null;
}

// Champs transmis au modèle : jamais de ranking, de note ni de score.
const ficheVin = (v: VinPresentation) => ({
  id: v.id, nom: v.nom, producteur: v.producteur, millesime: v.millesime, couleur: v.couleur, region: v.region, cepages: v.cepages,
  descriptif: v.descriptif?.replace(/\s+/g, ' ').slice(0, 1200) ?? null,
  commentaires: v.commentaires?.replace(/\s+/g, ' ').slice(0, 800) ?? null,
});

export function construirePrompt(vins: VinPresentation[], nomRestaurant: string, dejaEcrits: string[] = []) {
  return `Tu es Pat le sommelier. Rédige la présentation de chaque vin pour la carte des vins imprimée du restaurant ${nomRestaurant}.

Pour chaque vin, 3 phrases en français, de 40 à 60 mots, entre ${LONGUEUR_MIN} et ${LONGUEUR_MAX} caractères :
1. le lieu ou le vigneron (terroir, sol, altitude, histoire du domaine) ;
2. le style du vin, expliqué par sa cause (pourquoi il est frais, souple, tendu), avec ses arômes ;
3. ce avec quoi il brille à table, en termes généraux (poissons, viandes rouges, fromages…).
Règles :
- appuie-toi uniquement sur les champs fournis (descriptif, commentaires, cépages) ; n'invente aucun fait,
  aucune date, aucun classement officiel absent des données ; si un champ manque, reste général ;
- reformule le descriptif dans la voix de Pat, ne le recopie jamais mot pour mot ;
- toujours positif : dis ce que le vin a de beau, jamais ce qui lui manque ;
- aucune note, aucun classement de Pat, aucun score, aucune comparaison de prix ;
- pas de clichés de dégustation (« bouche ample », « belle longueur », « nez complexe ») ;
- deux vins de la même couleur ne commencent pas par les mêmes mots.
Mots interdits, sous toutes leurs formes : ${MOTS_INTERDITS.map(([m]) => m).join(', ')}.
${dejaEcrits.length ? `\nPrésentations déjà écrites pour cette couleur (ne pas les répéter ni commencer de la même façon) :\n${dejaEcrits.map((m) => `- ${m}`).join('\n')}\n` : ''}
Réponds uniquement en JSON, sans texte autour : [{"id": "...", "texte": "..."}]

Vins :
${JSON.stringify(vins.map(ficheVin), null, 1)}`;
}

/** Problèmes d'une présentation (vide si elle est valide). */
export function verifierPresentation(texte: string | null | undefined): string[] {
  const t = (texte ?? '').trim();
  if (!t) return ['vide'];
  const problemes: string[] = [];
  if (t.length < LONGUEUR_MIN) problemes.push(`trop courte (${t.length} caractères)`);
  if (t.length > LONGUEUR_MAX) problemes.push(`trop longue (${t.length} caractères)`);
  const bas = sansAccents(t);
  for (const [m, re] of MOTS_INTERDITS) if (re.test(bas)) problemes.push(`mot interdit : ${m}`);
  return problemes;
}

/** Paires de présentations trop proches (même début ou vocabulaire très semblable). */
export function trouverDoublons(textes: { id: string; texte: string }[]) {
  const norm = (s: string) => sansAccents(s).replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  const doublons: [string, string][] = [];
  for (let i = 0; i < textes.length; i++) {
    for (let j = i + 1; j < textes.length; j++) {
      const a = norm(textes[i].texte), b = norm(textes[j].texte);
      const memeDebut = a.slice(0, 4).join(' ') === b.slice(0, 4).join(' ');
      const communs = a.filter((w) => b.includes(w)).length;
      const jaccard = communs / (new Set([...a, ...b]).size || 1);
      if (memeDebut || jaccard > 0.5) doublons.push([textes[i].id, textes[j].id]);
    }
  }
  return doublons;
}

function lireJson(texte: string): { id: string; texte: string }[] {
  const debut = texte.indexOf('['), fin = texte.lastIndexOf(']');
  if (debut < 0 || fin < debut) throw new Error('réponse sans tableau JSON');
  return (JSON.parse(texte.slice(debut, fin + 1)) as unknown[]).flatMap((x) => {
    const o = x as Record<string, unknown>;
    return typeof o?.id === 'string' && typeof o?.texte === 'string' ? [{ id: o.id, texte: o.texte.trim() }] : [];
  });
}

/**
 * Génère les présentations couleur par couleur ; renvoie { idVin: présentation } pour les textes valides.
 * Les vins absents du résultat restent à relire (ou à écrire) par le restaurant.
 * Les vins déjà corrigés par le restaurant ne doivent pas être passés ici.
 */
export async function genererPresentations(vins: VinPresentation[], nomRestaurant: string, client: Anthropic, modele: string, essaisMax = 2) {
  const resultat: Record<string, string> = {};
  for (const couleur of [...new Set(vins.map((v) => v.couleur))]) {
    const deCetteCouleur = vins.filter((v) => v.couleur === couleur);
    let aFaire = deCetteCouleur;
    for (let essai = 0; essai <= essaisMax && aFaire.length; essai++) {
      const dejaEcrits = deCetteCouleur.filter((v) => resultat[v.id]).map((v) => resultat[v.id]);
      const m = await client.messages.stream({ model: modele, max_tokens: 32000, messages: [{ role: 'user', content: construirePrompt(aFaire, nomRestaurant, dejaEcrits) }] }).finalMessage();
      const ids = new Set(aFaire.map((v) => v.id));
      for (const x of lireJson(m.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))) {
        if (ids.has(x.id) && !verifierPresentation(x.texte).length) resultat[x.id] = x.texte;
      }
      // Quasi-doublons dans la couleur : le second de chaque paire est refait.
      const ecrits = deCetteCouleur.filter((v) => resultat[v.id]).map((v) => ({ id: v.id, texte: resultat[v.id] }));
      for (const [, id2] of trouverDoublons(ecrits)) delete resultat[id2];
      aFaire = deCetteCouleur.filter((v) => !resultat[v.id]);
    }
  }
  return resultat;
}
