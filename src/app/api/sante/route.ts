// Santé du site (Coolify sur Hetzner) : une nouvelle version ne remplace l'ancienne que si elle répond ici, base comprise.
import { requete } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requete('select 1');
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, erreur: 'base injoignable' }, { status: 503 });
  }
}
