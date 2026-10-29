import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
 * - back-office (/admin) et App (/pat) : la session Supabase est rafraîchie.
 */
export async function middleware(req: NextRequest) {
  const redirection = process.env.REDIRIGER_VERS;
  if (redirection && req.nextUrl.host !== new URL(redirection).host) {
    return NextResponse.redirect(new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, redirection), 308);
  }
  if (process.env.MAINTENANCE === '1') {
    return new NextResponse(MAINTENANCE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '900', 'cache-control': 'no-store' } });
  }
  let res = NextResponse.next({ request: req });
  if (!/^\/(admin|pat)(\/|$)/.test(req.nextUrl.pathname)) return res;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return res;
  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (aPoser) => {
        aPoser.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        aPoser.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}

// Toutes les pages (maintenance et redirection), sauf les fichiers du site (scripts, images, polices).
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)'] };
