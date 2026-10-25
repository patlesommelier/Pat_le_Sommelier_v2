import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { couleurDominante, couleurImpression } from './couleurs';

/** Couleur dominante du logo d'un restaurant (adresse publique ou fichier de public/), ou null. Jamais d'erreur. */
const luminance = (r: number, g: number, b: number) => {
  const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/**
 * Le logo se voit-il sur ce fond ? Contraste entre la luminance moyenne de ses pixels visibles et celle du fond (#RRGGBB).
 * null : logo illisible par le serveur (on le laisse tel quel).
 */
export async function contrasteLogo(url: string | null | undefined, fond: string): Promise<number | null> {
  if (!url) return null;
  try {
    const octets = url.startsWith('/')
      ? await fs.readFile(path.join(process.cwd(), 'public', decodeURIComponent(url.split('?')[0])))
      : Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(5000) })).arrayBuffer());
    const { data } = await sharp(octets).resize(80, 80, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let somme = 0, n = 0;
    for (let i = 0; i + 3 < data.length; i += 4) if (data[i + 3] >= 128) { somme += luminance(data[i], data[i + 1], data[i + 2]); n++; }
    if (!n) return null;
    const f = parseInt(fond.slice(1), 16);
    const [l1, l2] = [somme / n, luminance((f >> 16) & 255, (f >> 8) & 255, f & 255)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  } catch {
    return null;
  }
}

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

export interface CouleurSupports { couleur: string; app: string; logo: string | null; choix: 'auto' | 'app' | 'logo' | 'autre' | 'apparence'; apparence: string | null }

/**
 * Couleur d'un support imprimé, d'après l'adresse (?teinte=auto|app|logo, ou ?couleur=#RRGGBB) ; par défaut, celle choisie dans
 * « Apparence », sinon automatique : celle de l'app si elle se lit sur le blanc (bleu foncé…), sinon celle du logo (couleurImpression).
 */
export async function couleurDesSupports(r: { couleur: string; logo_url: string | null; logo_fonce_url?: string | null; couleur_impression?: string | null },
  sp: URLSearchParams): Promise<CouleurSupports> {
  const logo = (await couleurDuLogo(r.logo_fonce_url)) ?? (await couleurDuLogo(r.logo_url));
  const apparence = r.couleur_impression && /^#[0-9a-f]{6}$/i.test(r.couleur_impression) ? r.couleur_impression.toUpperCase() : null;
  const base = { app: r.couleur, logo, apparence };
  const autre = sp.get('couleur');
  if (autre && /^#[0-9a-f]{6}$/i.test(autre)) return { ...base, couleur: autre.toUpperCase(), choix: 'autre' };
  if (sp.get('teinte') === 'app') return { ...base, couleur: r.couleur, choix: 'app' };
  if (sp.get('teinte') === 'logo' && logo) return { ...base, couleur: logo, choix: 'logo' };
  if (sp.get('teinte') === 'auto' || !apparence) return { ...base, couleur: couleurImpression(r.couleur, logo), choix: 'auto' };
  return { ...base, couleur: apparence, choix: 'apparence' }; // couleur choisie dans « Apparence »
}

/** Choix de la couleur dans la barre d'outils d'impression (écran seulement). Le script de la page lit « teinte » et « couleur ». */
export function controleCouleur(c: CouleurSupports) {
  const opt = (v: string, libelle: string) => `<option value="${v}" ${c.choix === v ? 'selected' : ''}>${libelle}</option>`;
  return `<label>Couleur <select name="teinte" onchange="this.form.elements.couleur.dataset.choisie = ''; envoyer(this.form)">
    ${c.apparence ? opt('apparence', `d’Apparence (${c.apparence})`) : ''}${opt('auto', 'automatique')}${opt('app', `de l’app (${c.app})`)}${c.logo ? opt('logo', `du logo (${c.logo})`) : ''}${c.choix === 'autre' ? opt('autre', 'choisie') : ''}
  </select></label>
  <label title="Choisir une autre couleur"><input type="color" name="couleur" value="${c.couleur.toLowerCase()}" data-choisie="${c.choix === 'autre' ? '1' : ''}" style="width:34px;height:26px;padding:0;border:0;background:none;vertical-align:middle"
    onchange="this.dataset.choisie = '1'; envoyer(this.form)"></label>`;
}

/** Ligne du script `envoyer` des barres d'impression : ajoute la couleur choisie aux paramètres `p`. */
export const SCRIPT_COULEUR = `if (f.elements.couleur && f.elements.couleur.dataset.choisie) p.set('couleur', f.elements.couleur.value);
  else if (f.elements.teinte && ['auto', 'app', 'logo'].indexOf(f.elements.teinte.value) >= 0) p.set('teinte', f.elements.teinte.value);`;
