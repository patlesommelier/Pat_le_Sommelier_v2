// Fiches des vins trouvées par le plan du site du distributeur (sans recherche web).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contenuDePage, pageDuVin, pagesDuSite } from '../src/lib/distributeurs/plansite';

test('plan du site : robots.txt, index, plan des produits ; les plans d’articles sont ignorés', async () => {
  const site: Record<string, string> = {
    'https://www.cinoco.be/robots.txt': 'User-agent: *\nSitemap: https://www.cinoco.be/sitemap_index.xml',
    'https://www.cinoco.be/sitemap_index.xml': '<sitemapindex><sitemap><loc>https://www.cinoco.be/post-sitemap.xml</loc></sitemap><sitemap><loc>https://www.cinoco.be/product-sitemap.xml</loc></sitemap></sitemapindex>',
    'https://www.cinoco.be/product-sitemap.xml': '<urlset><url><loc>https://www.cinoco.be/produit/ferrari-maximum-brut/</loc></url><url><loc>https://www.cinoco.be/produit/ferrari-perle-2017/</loc></url></urlset>',
  };
  const lus: string[] = [];
  const pages = await pagesDuSite('cinoco.be', async (u) => { lus.push(u); return site[u] ?? null; });
  assert.deepEqual(pages, ['https://www.cinoco.be/produit/ferrari-maximum-brut/', 'https://www.cinoco.be/produit/ferrari-perle-2017/']);
  assert.ok(!lus.includes('https://www.cinoco.be/post-sitemap.xml'));
});

test('page du vin : tous les mots du nom et le producteur ; le millésime départage ; ambigu → null', () => {
  const pages = ['https://x.be/produit/ferrari-maximum-brut/', 'https://x.be/produit/ferrari-perle-2016/', 'https://x.be/produit/ferrari-perle-2017/',
    'https://x.be/produit/bellavista-perle/', 'https://x.be/fr/vin/domaine-roc-rouge/', 'https://x.be/fr/vin/domaine-roc-blanc/'];
  assert.equal(pageDuVin(pages, { producteur: 'Ferrari', nom: 'Maximum Brut' }), 'https://x.be/produit/ferrari-maximum-brut/');
  assert.equal(pageDuVin(pages, { producteur: 'Ferrari', nom: 'Perlé', millesime: '2017' }), 'https://x.be/produit/ferrari-perle-2017/');
  assert.equal(pageDuVin(pages, { producteur: 'Ferrari', nom: 'Perlé' }), null);
  assert.equal(pageDuVin(pages, { producteur: 'Domaine du Roc', nom: 'Rouge' }), 'https://x.be/fr/vin/domaine-roc-rouge/');
  assert.equal(pageDuVin(pages, { producteur: 'Ca’ del Bosco', nom: 'Cuvée Prestige' }), null);
});

test('contenu de page : texte sans menus ni scripts, images de la fiche', () => {
  const html = `<html><head><meta property="og:image" content="/wp/ferrari-maximum.jpg"><script>var x=1</script></head>
    <body><nav>Accueil Boutique</nav><main><h1>Ferrari Maximum Brut</h1><p>Appellation : Trento DOC</p><p>Cépages : Chardonnay 100&nbsp;%</p>
    <img src="/logo.png"><img data-src="https://cdn.x.be/bouteille.png"></main><footer>Contact</footer></body></html>`;
  const c = contenuDePage(html, 'https://www.cinoco.be/produit/ferrari-maximum-brut/');
  assert.match(c.texte, /Trento DOC/);
  assert.match(c.texte, /Chardonnay 100 %/);
  assert.doesNotMatch(c.texte, /Accueil|Contact|var x/);
  assert.deepEqual(c.images, ['https://www.cinoco.be/wp/ferrari-maximum.jpg', 'https://cdn.x.be/bouteille.png']);
});
