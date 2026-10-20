import Link from 'next/link';
import { Entete } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

/** Accords mets-vins de référence de l'App consommateur (data/app/accords-reference.json, chargés dans la base). */
export default async function AccordsReference({ searchParams }: { searchParams: Promise<{ famille?: string; q?: string }> }) {
  await exigerAdmin();
  const { famille = '', q = '' } = await searchParams;
  const [familles, lignes] = await Promise.all([
    requete<{ famille: string; n: number }>(`select famille, count(*)::int as n from accord_reference group by famille order by famille`),
    requete<{ id: string; nom: string; famille: string; sous_famille: string | null; vins_recommandes: string | null; alternative_accessible: string | null; justification_charnelle: string | null }>(
      `select id, nom, famille, sous_famille, vins_recommandes, alternative_accessible, justification_charnelle from accord_reference
        where ($1 = '' or famille = $1) and ($2 = '' or nom ilike '%' || $2 || '%' or variantes ilike '%' || $2 || '%') order by famille, nom`, [famille, q.trim()]),
  ]);
  const lien = (f: string) => `/admin/super/accords-reference${f ? `?famille=${encodeURIComponent(f)}` : ''}`;
  return (
    <>
      <Entete titre="Accords de référence" texte="Les accords mets-vins que Pat présente dans l’App consommateur : pour chaque plat, les vins conseillés, pourquoi, une alternative plus accessible et deux autres pistes." />
      <nav className="onglets" aria-label="Familles">
        <Link href={lien('')} aria-current={!famille ? 'true' : undefined}>Toutes <span>{familles.reduce((t, f) => t + f.n, 0)}</span></Link>
        {familles.map((f) => <Link key={f.famille} href={lien(f.famille)} aria-current={famille === f.famille ? 'true' : undefined}>{f.famille.replace(/^[A-Z]\.\s*/, '')} <span>{f.n}</span></Link>)}
      </nav>
      <form method="get" className="carte-bo" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '14px 18px' }}>
        {famille && <input type="hidden" name="famille" value={famille} />}
        <div className="champ" style={{ flex: 1 }}><label htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={q} placeholder="Plat…" /></div>
        <button className="btn petit">Chercher</button>
      </form>
      <div className="tableau">
        <table style={{ minWidth: 820 }}>
          <thead><tr><th>Plat</th><th>Vins conseillés</th><th>Plus accessible</th><th>Pourquoi</th></tr></thead>
          <tbody>
            {lignes.map((a) => (
              <tr key={a.id}>
                <td style={{ minWidth: 180 }}><b>{a.nom}</b><div className="petit">{a.sous_famille ?? a.famille}</div></td>
                <td style={{ minWidth: 200 }}>{a.vins_recommandes}</td>
                <td style={{ minWidth: 160 }}>{a.alternative_accessible ?? '—'}</td>
                <td><p className="petit" style={{ margin: 0, maxWidth: 420, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.justification_charnelle}</p></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
