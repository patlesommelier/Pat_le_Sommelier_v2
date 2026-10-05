import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { versExcel, versJson } from '@/lib/principes/format';
import { lireVersion } from '@/lib/principes/versions';

export const dynamic = 'force-dynamic';

/** Export d'une version des principes au format de Pat : /admin/super/principes/export?code=V6&format=xlsx|json */
export async function GET(req: Request) {
  await exigerAdmin();
  const sp = new URL(req.url).searchParams;
  const v = await lireVersion(requete, sp.get('code') ?? '');
  if (!v) return new Response('Version introuvable', { status: 404 });
  const nom = `principes_pat_${v.code}`;
  if (sp.get('format') === 'json') {
    return new Response(versJson(v), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${nom}.json"` } });
  }
  return new Response(new Uint8Array(await versExcel(v)), {
    headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${nom}.xlsx"` },
  });
}
