import { NextResponse, type NextRequest } from 'next/server';
import { redirectionDomaine } from './lib/domaines';

// Page de maintenance (bascule vers Hetzner) : le site n'écrit plus rien pendant la copie de la base.
const MAINTENANCE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pat revient dans quelques minutes</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FEFAF1;color:#241F20;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><h1 style="color:#680021;font-size:28px;margin:0 0 12px">Pat revient dans quelques minutes</h1>
<p style="margin:0;font-size:17px;line-height:1.5">Nous améliorons le service. Merci de réessayer un peu plus tard.</p></div></body></html>`;

/**
 * À chaque requête :
 * - REDIRIGER_VERS (l'ancien site, après la bascule) : tout renvoie à la même page sur la nouvelle adresse (anciens QR codes) ;
 * - MAINTENANCE=1 : page de maintenance, rien d'autre ne passe ;
 * - URL_ADMIN : chaque page sur sa bonne adresse (restaurateurs sur quidvinum.com, apps des clients sur patlesommelier.com).
 */
export async function middleware(req: NextRequest) {
  const redirection = process.env.REDIRIGER_VERS;
  if (redirection && req.nextUrl.host !== new URL(redirection).host) {
    return NextResponse.redirect(new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, redirection), 308);
  }
  if (process.env.MAINTENANCE === '1') {
    return new NextResponse(MAINTENANCE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '900', 'cache-control': 'no-store' } });
  }
  const cible = redirectionDomaine(req.headers.get('host') ?? req.nextUrl.host, req.nextUrl.pathname);
  // Une app affichée dans l'espace restaurant (simulateur, démonstration) reste dans son cadre.
  if (cible && req.method === 'GET' && req.headers.get('sec-fetch-dest') !== 'iframe') {
    return NextResponse.redirect(`${cible}${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
  }
  return NextResponse.next();
}

// Toutes les pages (maintenance et redirection), sauf les fichiers du site (scripts, images, polices), et sauf les envois de
// formulaires (actions du serveur, en-tête Next-Action) : un envoi qui passe par ici est limité en taille (tarifs de plus de 10 Mo).
export const config = {
  matcher: [{
    source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)',
    missing: [{ type: 'header', key: 'next-action' }],
  }],
};
