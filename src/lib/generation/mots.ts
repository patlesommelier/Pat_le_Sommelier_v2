/**
 * « Le mot de Pat » : une phrase par vin pour la carte des vins imprimée.
 * Génération par Claude couleur par couleur (le modèle voit les autres vins de la couleur et varie),
 * contrôle automatique, puis régénération des phrases refusées. Côté serveur uniquement.
 * Pas d'import « server-only » : utilisé aussi par le script `npm run mots`.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { MOTS_INTERDITS as INTERDITS_ACCORDS } from './controle';

export const LONGUEUR_MAX = 90; // caractères : tient sur une ligne en A4

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, ' ');

/** Mots interdits des commentaires d'accord (avec leurs variantes), plus ce qui trahirait la cuisine interne. */
export const MOTS_INTERDITS: [string, RegExp][] = [...INTERDITS_ACCORDS, ['ranking', /\branking\w*/], ['score', /\bscores?\b/], ['note', /\bnote \d|\d\s*\/\s*5\b/]];

export interface VinMot {
  id: string; nom: string; producteur: string | null; millesime: string | null; couleur: string; region: string | null;
  cepages: string | null; commentaires: string | null; descriptif: string | null;
}

// Champs transmis au modèle : jamais de ranking, de note ni de score.
const ficheVin = (v: VinMot) => ({
  id: v.id, nom: v.nom, producteur: v.producteur, millesime: v.millesime, couleur: v.couleur, region: v.region,
  cepages: v.cepages, commentaires: v.commentaires, descriptif: v.descriptif?.replace(/\s+/g, ' ').slice(0, 600) ?? null,
});

export function construirePrompt(vins: VinMot[], nomRestaurant: string, dejaEcrits: string[] = []) {
  return `Tu es Pat le sommelier. Rédige « le mot de Pat » pour la carte des vins imprimée du restaurant ${nomRestaurant}.

Pour chaque vin, une seule phrase en français, de 8 à 16 mots, ${LONGUEUR_MAX} caractères au maximum :
- appuie-toi uniquement sur les champs fournis (cépages, commentaires, descriptif) ; n'invente aucun fait ;
- cite au moins un élément propre à ce vin (cépage, terroir, élevage, producteur, millésime) : la phrase ne doit pas pouvoir s'appliquer à un autre vin de la liste ;
- toujours positive : dis ce que le vin a de beau, jamais ce qui lui manque ;
- aucun chiffre de note, de classement ou de score, aucune comparaison de prix ;
- pas de clichés de dégustation (« bouche ample », « belle longueur », « nez complexe ») ;
- deux vins de la même couleur ne commencent pas par les mêmes mots.
Mots interdits, sous toutes leurs formes : ${MOTS_INTERDITS.map(([m]) => m).join(', ')}.
${dejaEcrits.length ? `\nPhrases déjà écrites pour cette couleur (ne pas les répéter ni commencer de la même façon) :\n${dejaEcrits.map((m) => `- ${m}`).join('\n')}\n` : ''}
Réponds uniquement en JSON, sans texte autour : [{"id": "...", "mot": "..."}]

Vins :
${JSON.stringify(vins.map(ficheVin), null, 1)}`;
}

/** Problèmes d'une phrase (vide si elle est valide). */
export function verifierMot(mot: string | null | undefined): string[] {
  const problemes: string[] = [];
  const t = (mot ?? '').trim();
  if (!t) problemes.push('vide');
  if (t.length > LONGUEUR_MAX) problemes.push(`trop longue (${t.length} caractères)`);
  const bas = sansAccents(t);
  for (const [m, re] of MOTS_INTERDITS) if (re.test(bas)) problemes.push(`mot interdit : ${m}`);
  return problemes;
}

/** Paires de phrases trop proches (même début ou mots très semblables). */
export function trouverDoublons(mots: { id: string; mot: string }[]) {
  const norm = (s: string) => sansAccents(s).replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  const doublons: [string, string][] = [];
  for (let i = 0; i < mots.length; i++) {
    for (let j = i + 1; j < mots.length; j++) {
      const a = norm(mots[i].mot), b = norm(mots[j].mot);
      const memeDebut = a.slice(0, 3).join(' ') === b.slice(0, 3).join(' ');
      const communs = a.filter((w) => b.includes(w)).length;
      const jaccard = communs / (new Set([...a, ...b]).size || 1);
      if (memeDebut || jaccard > 0.5) doublons.push([mots[i].id, mots[j].id]);
    }
  }
  return doublons;
}

function lireJson(texte: string): { id: string; mot: string }[] {
  const debut = texte.indexOf('['), fin = texte.lastIndexOf(']');
  if (debut < 0 || fin < debut) throw new Error('réponse sans tableau JSON');
  return (JSON.parse(texte.slice(debut, fin + 1)) as unknown[]).flatMap((x) => {
    const o = x as Record<string, unknown>;
    return typeof o?.id === 'string' && typeof o?.mot === 'string' ? [{ id: o.id, mot: o.mot.trim() }] : [];
  });
}

/**
 * Génère les mots couleur par couleur ; renvoie { idVin: phrase } pour les phrases valides.
 * Les vins absents du résultat restent à relire (ou à écrire) par le restaurant.
 */
export async function genererMots(vins: VinMot[], nomRestaurant: string, client: Anthropic, modele: string, essaisMax = 2) {
  const resultat: Record<string, string> = {};
  for (const couleur of [...new Set(vins.map((v) => v.couleur))]) {
    const deCetteCouleur = vins.filter((v) => v.couleur === couleur);
    let aFaire = deCetteCouleur;
    for (let essai = 0; essai <= essaisMax && aFaire.length; essai++) {
      const dejaEcrits = deCetteCouleur.filter((v) => resultat[v.id]).map((v) => resultat[v.id]);
      const m = await client.messages.stream({ model: modele, max_tokens: 16000, messages: [{ role: 'user', content: construirePrompt(aFaire, nomRestaurant, dejaEcrits) }] }).finalMessage();
      const ids = new Set(aFaire.map((v) => v.id));
      for (const x of lireJson(m.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))) {
        if (ids.has(x.id) && !verifierMot(x.mot).length) resultat[x.id] = x.mot;
      }
      // Quasi-doublons dans la couleur : le second de chaque paire est refait.
      const ecrits = deCetteCouleur.filter((v) => resultat[v.id]).map((v) => ({ id: v.id, mot: resultat[v.id] }));
      for (const [, id2] of trouverDoublons(ecrits)) delete resultat[id2];
      aFaire = deCetteCouleur.filter((v) => !resultat[v.id]);
    }
  }
  return resultat;
}
