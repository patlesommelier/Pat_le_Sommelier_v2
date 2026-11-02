// Fiches des vins trouvées sans IA sur le site du distributeur : son plan (sitemap) donne l'adresse de chaque page,
// rapprochée du nom du vin ; la page est lue par le serveur (gratuit), et seul son texte utile est donné à Claude.
// Bien moins cher que la recherche web de Claude, qui lit de longues pages de résultats à chaque recherche.
import { mots, norm } from '../inscription/lecture';

type Lecteur = (url: string) => Promise<string | null>;

const NAVIGATEUR = 'Mozilla/5.0 (compatible; QuidVinum/1.0; +https://quidvinum.be)';

/** Contenu texte d'une adresse (15 s, 5 Mo au plus) ; null en cas d'erreur. */
export const lireUrl: Lecteur = async (url) => {
  try {
    const r = await fetch(url, { headers: { 'user-agent': NAVIGATEUR, accept: 'text/html,application/xml,text/xml,*/*' }, signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    if (!r.ok) return null;
    const t = await r.text();
    return t.length > 5_000_000 ? t.slice(0, 5_000_000) : t;
  } catch { return null; }
};

const balises = (xml: string) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
const estPlan = (u: string) => /\.xml(\.gz)?($|\?)/i.test(u) || /sitemap/i.test(u);
// Plans à lire d'abord (produits, vins), et à laisser de côté (articles, catégories, auteurs, images…).
const PRIORITE = /product|produit|produkt|wine|vin|wijn|catalog|shop|boutique/i;
const INUTILE = /post-sitemap|page-sitemap|category|categorie|tag|author|auteur|attachment|image|video|news|blog|brand/i;

/** Adresses des pages du site, lues dans son plan (robots.txt, puis les emplacements usuels). Vide si le site n'en a pas. */
export async function pagesDuSite(domaine: string, lire: Lecteur = lireUrl): Promise<string[]> {
  const racines = [`https://www.${domaine}`, `https://${domaine}`];
  const aLire: string[] = [];
  for (const r of racines) {
    const robots = await lire(`${r}/robots.txt`);
    const plans = robots ? [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
    if (plans.length) { aLire.push(...plans); break; }
  }
  if (!aLire.length) for (const r of racines) aLire.push(`${r}/sitemap.xml`, `${r}/sitemap_index.xml`, `${r}/wp-sitemap.xml`, `${r}/product-sitemap.xml`);
  const vus = new Set<string>(), pages = new Set<string>();
  let lus = 0;
  while (aLire.length && lus < 40 && pages.size < 60_000) {
    aLire.sort((a, b) => Number(PRIORITE.test(b)) - Number(PRIORITE.test(a)));
    const u = aLire.shift()!;
    if (vus.has(u)) continue;
    vus.add(u);
    const xml = await lire(u);
    lus++;
    if (!xml || !/<(urlset|sitemapindex)\b/i.test(xml)) continue;
    for (const loc of balises(xml)) {
      if (/<sitemapindex\b/i.test(xml) || (estPlan(loc) && !/\.html?$/i.test(loc))) { if (!INUTILE.test(loc) && !vus.has(loc)) aLire.push(loc); }
      else pages.add(loc);
    }
  }
  return [...pages];
}

const motsAdresse = (url: string) => {
  let chemin: string;
  try { chemin = decodeURIComponent(new URL(url).pathname); } catch { chemin = url; }
  return new Set(norm(chemin).split(/[^a-z0-9]+/).filter(Boolean));
};

/**
 * Page du vin parmi les pages du site : son adresse contient tous les mots significatifs du nom du vin et au moins un mot
 * du producteur (si le nom du vin n'en a pas, tous ceux du producteur). Avec plusieurs pages, celle dont l'adresse a le moins d'autres mots
 * (et le millésime quand il y figure). null si aucune ou si deux pages se valent sans le millésime pour trancher.
 */
export function pageDuVin(pages: string[], v: { producteur: string; nom: string; millesime?: string | null }, index?: Map<string, Set<string>>): string | null {
  const duNom = mots(v.nom).filter((m) => !/^\d{4}$/.test(m));
  const duProducteur = mots(v.producteur);
  if (!duNom.length && !duProducteur.length) return null;
  const candidates: { url: string; autres: number; millesime: boolean }[] = [];
  for (const url of pages) {
    const m = index?.get(url) ?? motsAdresse(url);
    if (!duNom.every((x) => m.has(x))) continue;
    if (duProducteur.length && (duNom.length ? !duProducteur.some((x) => m.has(x)) : !duProducteur.every((x) => m.has(x)))) continue;
    const connus = new Set([...duNom, ...duProducteur]);
    candidates.push({ url, autres: [...m].filter((x) => x.length > 2 && !connus.has(x) && !/^\d+$/.test(x)).length, millesime: Boolean(v.millesime && m.has(v.millesime)) });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => Number(b.millesime) - Number(a.millesime) || a.autres - b.autres || a.url.length - b.url.length);
  const [a, b] = candidates;
  if (b && b.millesime === a.millesime && b.autres === a.autres) return null; // ambigu : la recherche web tranchera
  return a.url;
}

/** Index des mots de chaque adresse (calculé une fois pour tous les vins). */
export const indexDesPages = (pages: string[]) => new Map(pages.map((u) => [u, motsAdresse(u)]));

const entites = (t: string) => t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;/g, '’')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Texte utile d'une page (sans scripts, menus ni pied de page, 5 000 caractères au plus) et ses images candidates. */
export function contenuDePage(html: string, url: string): { texte: string; images: string[] } {
  const absolue = (src: string) => { try { return new URL(entites(src.trim()), url).href; } catch { return null; } };
  const images: string[] = [];
  const ajouter = (src: string | undefined | null) => { const a = src ? absolue(src) : null; if (a && /^https?:/.test(a) && !/\.svg($|\?)|logo|icon|sprite|placeholder|pixel|banner/i.test(a) && !images.includes(a)) images.push(a); };
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/gi)) ajouter(/content=["']([^"']+)/i.exec(m[0])?.[1]);
  for (const m of html.matchAll(/"image"\s*:\s*(?:\[\s*)?(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/g)) ajouter(m[1].replace(/\\\//g, '/'));
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = /\s(?:data-large_image|data-zoom-image|data-src|src)=["']([^"']+)/i.exec(m[0])?.[1];
    if (src && !/^data:/.test(src)) ajouter(src);
    if (images.length >= 8) break;
  }
  const corps = (/<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ?? html)
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|p|div|li|tr|h\d|dt|dd)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const texte = entites(corps).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, 5000);
  return { texte, images: images.slice(0, 8) };
}
