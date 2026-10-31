// Photo de bouteille recadrée sur son étiquette : Claude (vision) donne le cadre de l'étiquette principale, le serveur découpe l'image.
// Une image qui est déjà l'étiquette à plat est gardée telle quelle. Sans « server-only » : utilisé en arrière-plan.
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

export interface Cadre { x: number; y: number; largeur: number; hauteur: number }

/** Cadre lisible et plausible (en fractions de l'image, assez grand) ; null sinon. */
export function cadreValide(c: unknown): Cadre | null {
  if (!c || typeof c !== 'object') return null;
  const { x, y, largeur, hauteur } = c as Record<string, unknown>;
  const n = [x, y, largeur, hauteur].map(Number);
  if (n.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return null;
  const [cx, cy, cl, ch] = n;
  if (cl < 0.08 || ch < 0.05 || cx + cl > 1.02 || cy + ch > 1.02) return null;
  return { x: cx, y: cy, largeur: Math.min(cl, 1 - cx), hauteur: Math.min(ch, 1 - cy) };
}

/** Cadre en pixels, avec une petite marge autour, dans les limites de l'image. */
export function cadreEnPixels(c: Cadre, largeur: number, hauteur: number, marge = 0.03) {
  const left = Math.max(0, Math.floor((c.x - marge * c.largeur) * largeur));
  const top = Math.max(0, Math.floor((c.y - marge * c.hauteur) * hauteur));
  const right = Math.min(largeur, Math.ceil((c.x + c.largeur * (1 + marge)) * largeur));
  const bottom = Math.min(hauteur, Math.ceil((c.y + c.hauteur * (1 + marge)) * hauteur));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

const CONSIGNE = `Cette image montre une bouteille de vin, ou directement son étiquette.
Si c'est déjà l'étiquette seule (à plat, ou un gros plan qui la remplit presque entièrement), réponds {"deja": true}.
Si on voit une bouteille dont l'étiquette principale (face avant) est lisible, donne le cadre de cette étiquette, en fractions de la largeur
et de la hauteur de l'image, depuis le coin en haut à gauche : {"x": 0.30, "y": 0.52, "largeur": 0.40, "hauteur": 0.30}
(l'étiquette principale seulement, pas la collerette ni la capsule). Si aucune étiquette n'est lisible, réponds {"aucune": true}.
Réponds uniquement en JSON, sans texte autour.`;

export type Recadrage = { octets: Buffer; type: string; resultat: 'recadree' | 'deja' | 'aucune' | 'petite' | 'echec' };

/** En dessous de cette taille (plus petit côté, en pixels), une photo ne permet pas de lire une étiquette : vignette à remplacer. */
export const COTE_MINIMUM = 300;

/** Image recadrée sur l'étiquette (JPEG) ; l'image d'origine si elle est déjà l'étiquette, ou si le cadre n'a pas pu être trouvé. */
export async function recadrerSurEtiquette(client: Anthropic, modele: string, octets: Buffer, type: string): Promise<Recadrage> {
  try {
    const image = sharp(octets).rotate();
    const { width = 0, height = 0 } = await image.metadata();
    if (!width || !height) return { octets, type, resultat: 'echec' };
    if (Math.min(width, height) < COTE_MINIMUM) return { octets, type, resultat: 'petite' }; // vignette : sans appel à Claude
    const apercu = await sharp(octets).rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const m = await client.messages.create({
      model: modele, max_tokens: 400,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: apercu.toString('base64') } },
        { type: 'text', text: CONSIGNE },
      ] }],
    }, { timeout: 90_000 });
    const texte = m.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const debut = texte.indexOf('{'), fin = texte.lastIndexOf('}');
    const r = debut >= 0 ? (() => { try { return JSON.parse(texte.slice(debut, fin + 1)) as Record<string, unknown>; } catch { return null; } })() : null;
    if (r?.deja) return { octets, type, resultat: 'deja' };
    if (r?.aucune) return { octets, type, resultat: 'aucune' };
    const cadre = cadreValide(r);
    if (!cadre) return { octets, type, resultat: 'echec' };
    const decoupe = await image.extract(cadreEnPixels(cadre, width, height)).jpeg({ quality: 90 }).toBuffer();
    return { octets: decoupe, type: 'image/jpeg', resultat: 'recadree' };
  } catch (e) {
    console.error('[recadrage]', (e as Error).message);
    return { octets, type, resultat: 'echec' };
  }
}

