// Santé du site (Coolify sur Hetzner) : une nouvelle version ne remplace l'ancienne que si elle répond ici, base comprise.
// Indique aussi les deux adresses comprises par le site (noms de domaine seulement), pour vérifier les renvois.
import { requete } from '@/lib/db';
import { redirectionDomaine } from '@/lib/domaines';

export const dynamic = 'force-dynamic';

const hote = (url: string | undefined) => { try { return url ? new URL(url.trim()).host : null; } catch { return url ? 'adresse illisible' : null; } };

export async function GET(req: Request) {
  const ici = req.headers.get('host') ?? '';
  const domaines = {
    restaurateurs: hote(process.env.URL_ADMIN), clients: hote(process.env.URL_PUBLIQUE), cetteAdresse: ici,
    renvoiDeChezPat: redirectionDomaine(ici, '/chez-pat'), renvoiDeAdmin: redirectionDomaine(ici, '/admin'),
  };
  try {
    await requete('select 1');
    return Response.json({ ok: true, domaines });
  } catch {
    return Response.json({ ok: false, erreur: 'base injoignable', domaines }, { status: 503 });
  }
}
