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

test('page du vin : le nom et le producteur ; le millésime départage ; deux vins différents → null', () => {
  const pages = ['https://x.be/produit/ferrari-maximum-brut/', 'https://x.be/produit/ferrari-perle-2016/', 'https://x.be/produit/ferrari-perle-2017/',
    'https://x.be/produit/bellavista-perle/', 'https://x.be/fr/vin/domaine-roc-rouge/', 'https://x.be/fr/vin/domaine-roc-blanc/'];
  assert.equal(pageDuVin(pages, { producteur: 'Ferrari', nom: 'Maximum Brut' }), 'https://x.be/produit/ferrari-maximum-brut/');
  assert.equal(pageDuVin(pages, { producteur: 'Ferrari', nom: 'Perlé', millesime: '2017' }), 'https://x.be/produit/ferrari-perle-2017/');
  // Sans millésime : deux millésimes du même vin, l'un ou l'autre (même étiquette).
  assert.match(pageDuVin(pages, { producteur: 'Ferrari', nom: 'Perlé' }) ?? '', /ferrari-perle-201[67]/);
  // Deux vins différents aussi proches : ambigu.
  assert.equal(pageDuVin(pages, { producteur: 'Domaine du Roc', nom: 'Rosé' }), null);
  assert.equal(pageDuVin(pages, { producteur: 'Domaine du Roc', nom: 'Rouge' }), 'https://x.be/fr/vin/domaine-roc-rouge/');
  assert.equal(pageDuVin(pages, { producteur: 'Ca’ del Bosco', nom: 'Cuvée Prestige' }), null);
});

test('page du vin : site de Cinoco (millésimes, formats, langues ; nom de la base différent du site)', () => {
  const pages = ['https://www.cinoco.com/produit/chateau-batailley-375cl-wb12-2024-2/', 'https://www.cinoco.com/nl/produit/chateau-batailley-wb6-2019-2/',
    'https://www.cinoco.com/produit/chateau-batailley-wb6-2019/', 'https://www.cinoco.com/produit/lions-de-batailley-wb6-2019/',
    'https://www.cinoco.com/produit/crozes-les-launes-delas-375cl-c12-2024/', 'https://www.cinoco.com/produit/crozes-les-launes-delas-c6-2023/',
    'https://www.cinoco.com/produit/trottevieille-saint-emilion-wb6-2019/', 'https://www.cinoco.com/nl/produit/trottevieille-saint-emilion-wb6-2019-2/'];
  assert.equal(pageDuVin(pages, { producteur: 'Château Batailley', nom: 'Pauillac', millesime: '2019' }), 'https://www.cinoco.com/produit/chateau-batailley-wb6-2019/');
  assert.equal(pageDuVin(pages, { producteur: 'Château Batailley', nom: 'Lions de Batailley' }), 'https://www.cinoco.com/produit/lions-de-batailley-wb6-2019/');
  assert.equal(pageDuVin(pages, { producteur: 'Delas', nom: 'Crozes-Hermitage Les Launes' }), 'https://www.cinoco.com/produit/crozes-les-launes-delas-c6-2023/');
  assert.equal(pageDuVin(pages, { producteur: 'Château Trottevieille', nom: 'Saint-Émilion Grand Cru', millesime: '2019' }), 'https://www.cinoco.com/produit/trottevieille-saint-emilion-wb6-2019/');
  // Producteur absent de l'adresse : tout le nom du vin suffit, et passe avant une page qui n'a qu'une partie du nom.
  const mouton = ['https://www.cinoco.com/produit/reserve-mouton-cadet-pauillac-c6-2021/', 'https://www.cinoco.com/produit/mouton-rothschild-pauillac-wb1-2021/',
    'https://www.cinoco.com/produit/reserve-mouton-cadet-medoc-c6-2019/'];
  assert.equal(pageDuVin(mouton, { producteur: 'Baron Philippe de Rothschild', nom: 'Réserve Mouton Cadet Pauillac', millesime: '2021' }), mouton[0]);
  assert.equal(pageDuVin(mouton, { producteur: 'Mouton Cadet', nom: 'Réserve Pauillac' }), mouton[0]);
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
