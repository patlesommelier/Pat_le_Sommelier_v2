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

// Mots d'adresse qui ne disent rien du vin : langue, rubrique, contenance (« 375cl »), conditionnement (« wb12 », « c6 »),
// numéros (millésime, doublon « -2 »). Deux pages qui ne diffèrent que par eux sont le même vin (autre millésime, format, langue).
const BRUIT = /^(\d+|\d+(?:[.,]\d+)?(?:cl|ml|l)|[a-z]{1,3}\d+|nl|fr|en|de|it|es|produit|produits|product|products|produkt|shop|boutique|vin|vins|wine|wines|wijn|magnum)$/;
const LANGUE = /^\/(nl|en|de|it|es)\//i;
const cheminDe = (url: string) => { try { return new URL(url).pathname; } catch { return url; } };

/**
 * Page du vin parmi les pages du site : son adresse contient le producteur et les mots du nom du vin (au moins la moitié
 * avec tout le producteur). Les pages qui ne diffèrent que par le millésime, la
 * contenance, le conditionnement ou la langue sont le même vin : on prend celle du bon millésime, en français, en 75 cl.
 * null si aucune, ou si deux vins différents (d'autres mots dans l'adresse) se valent.
 */
export function pageDuVin(pages: string[], v: { producteur: string; nom: string; millesime?: string | null }, index?: Map<string, Set<string>>): string | null {
  const duNom = mots(v.nom).filter((m) => !/^\d{4}$/.test(m));
  const duProducteur = mots(v.producteur);
  if (!duNom.length && !duProducteur.length) return null;
  const connus = new Set([...duNom, ...duProducteur]);
  const candidates: { url: string; manquants: number; sansProducteur: boolean; autres: string; nbAutres: number; millesime: boolean; langue: boolean; format: boolean; mots: number }[] = [];
  for (const url of pages) {
    const m = index?.get(url) ?? motsAdresse(url);
    // Le nom du vin dans la base n'est pas toujours celui du site (« Pauillac » pour « chateau-batailley ») : avec tout le
    // producteur dans l'adresse, la moitié des mots du nom suffit (arrondie en dessous) ; avec une partie, la moitié arrondie
    // au-dessus ; sans producteur, tous. La page la plus complète passe d'abord, et Claude vérifie ensuite que c'est le bon vin.
    const prod = duProducteur.filter((x) => m.has(x)).length;
    const trouves = duNom.filter((x) => m.has(x)).length;
    // Producteur absent de l'adresse (« Baron Philippe de Rothschild » pour « reserve-mouton-cadet-pauillac ») : accepté seulement
    // si tout le nom du vin y est, avec au moins deux mots.
    if (duProducteur.length && !prod && !(duNom.length >= 2 && trouves === duNom.length)) continue;
    const exiges = !duProducteur.length || !duNom.length || !prod ? duNom.length
      : prod === duProducteur.length ? Math.floor(duNom.length / 2) : Math.ceil(duNom.length / 2);
    if (trouves < exiges || (!duNom.length && prod < duProducteur.length)) continue;
    const manquants = duNom.length - trouves;
    const autres = [...m].filter((x) => !connus.has(x) && !BRUIT.test(x) && mots(x).length > 0).sort(); // sans « chateau », « domaine »…
    candidates.push({ url, manquants, sansProducteur: Boolean(duProducteur.length && !prod), autres: autres.join(' '), nbAutres: autres.length, millesime: Boolean(v.millesime && m.has(v.millesime)),
      langue: LANGUE.test(cheminDe(url)), format: [...m].some((x) => /^\d+(?:[.,]\d+)?(?:cl|ml|l)$/.test(x) && x !== '75cl'), mots: m.size });
  }
  if (!candidates.length) return null;
  // D'abord le vin le plus proche (le moins d'autres mots), puis, parmi ses variantes : le millésime, le français, la bouteille.
  candidates.sort((a, b) => a.manquants - b.manquants || Number(a.sansProducteur) - Number(b.sansProducteur) || a.nbAutres - b.nbAutres || Number(b.millesime) - Number(a.millesime) || Number(a.langue) - Number(b.langue)
    || Number(a.format) - Number(b.format) || a.mots - b.mots || a.url.length - b.url.length);
  const [a] = candidates;
  // Un autre vin (d'autres mots) aussi proche : ambigu, la recherche web tranchera.
  if (candidates.some((c) => c.manquants === a.manquants && c.sansProducteur === a.sansProducteur && c.nbAutres === a.nbAutres && c.autres !== a.autres)) return null;
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
