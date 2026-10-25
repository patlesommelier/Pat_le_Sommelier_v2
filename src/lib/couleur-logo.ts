import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { couleurDominante, couleurImpression } from './couleurs';

/** Couleur dominante du logo d'un restaurant (adresse publique ou fichier de public/), ou null. Jamais d'erreur. */
export async function couleurDuLogo(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const octets = url.startsWith('/')
      ? await fs.readFile(path.join(process.cwd(), 'public', decodeURIComponent(url.split('?')[0])))
      : Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(5000) })).arrayBuffer());
    const { data } = await sharp(octets).resize(80, 80, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return couleurDominante(data);
  } catch {
    return null;
  }
}

export interface CouleurSupports { couleur: string; app: string; logo: string | null; choix: 'auto' | 'app' | 'logo' | 'autre' }

/**
 * Couleur d'un support imprimé, d'après l'adresse (?teinte=app|logo, ou ?couleur=#RRGGBB) ; par défaut, automatique :
 * celle de l'app si elle se lit sur le blanc (bleu foncé…), sinon celle du logo (voir couleurImpression).
 */
export async function couleurDesSupports(r: { couleur: string; logo_url: string | null; logo_fonce_url?: string | null }, sp: URLSearchParams): Promise<CouleurSupports> {
  const logo = (await couleurDuLogo(r.logo_fonce_url)) ?? (await couleurDuLogo(r.logo_url));
  const autre = sp.get('couleur');
  if (autre && /^#[0-9a-f]{6}$/i.test(autre)) return { couleur: autre.toUpperCase(), app: r.couleur, logo, choix: 'autre' };
  if (sp.get('teinte') === 'app') return { couleur: r.couleur, app: r.couleur, logo, choix: 'app' };
  if (sp.get('teinte') === 'logo' && logo) return { couleur: logo, app: r.couleur, logo, choix: 'logo' };
  return { couleur: couleurImpression(r.couleur, logo), app: r.couleur, logo, choix: 'auto' };
}

/** Choix de la couleur dans la barre d'outils d'impression (écran seulement). Le script de la page lit « teinte » et « couleur ». */
export function controleCouleur(c: CouleurSupports) {
  const opt = (v: string, libelle: string) => `<option value="${v}" ${c.choix === v ? 'selected' : ''}>${libelle}</option>`;
  return `<label>Couleur <select name="teinte" onchange="this.form.elements.couleur.dataset.choisie = ''; envoyer(this.form)">
    ${opt('auto', 'automatique')}${opt('app', `de l’app (${c.app})`)}${c.logo ? opt('logo', `du logo (${c.logo})`) : ''}${c.choix === 'autre' ? opt('autre', 'choisie') : ''}
  </select></label>
  <label title="Choisir une autre couleur"><input type="color" name="couleur" value="${c.couleur.toLowerCase()}" data-choisie="${c.choix === 'autre' ? '1' : ''}" style="width:34px;height:26px;padding:0;border:0;background:none;vertical-align:middle"
    onchange="this.dataset.choisie = '1'; envoyer(this.form)"></label>`;
}

/** Ligne du script `envoyer` des barres d'impression : ajoute la couleur choisie aux paramètres `p`. */
export const SCRIPT_COULEUR = `if (f.elements.couleur && f.elements.couleur.dataset.choisie) p.set('couleur', f.elements.couleur.value);
  else if (f.elements.teinte && f.elements.teinte.value !== 'auto' && f.elements.teinte.value !== 'autre') p.set('teinte', f.elements.teinte.value);`;
