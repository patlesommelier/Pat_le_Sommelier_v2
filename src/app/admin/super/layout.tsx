import Link from 'next/link';
import { seDeconnecter } from '../actions';
import { NavSuper } from '@/components/admin/NavSuper';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Espace super-admin (Pat) : barre latérale foncée. La cuisine interne n'est lisible qu'ici. */
export default async function LayoutSuper({ children }: { children: React.ReactNode }) {
  const u = await exigerAdmin();
  const [[{ n }], [{ a }]] = await Promise.all([requete<{ n: number }>(`select count(*)::int as n from producteur where statut = 'propose'`),
    requete<{ a: number }>(`select count(*)::int as a from terroir where statut = 'propose'`)]);
  return (
    <div className="bo">
      <aside className="bo-nav sombre">
        <Link href="/admin/super" className="bo-marque">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/quidvinum/logo-clair.png" alt="Quid Vinum" className="logo-qv" />
          <span className="sous-marque">Super-admin<small>avec Pat le sommelier</small></span>
        </Link>
        <NavSuper aValider={n} appellationsAValider={a} />
        <div className="bo-bas">
          <Link href="/admin" style={{ color: '#EFEBE9' }}>Espace des restaurants →</Link>
          <span>{u.email}</span>
          <form action={seDeconnecter}><button type="submit" className="btn fantome petit" style={{ paddingLeft: 0 }}>Se déconnecter</button></form>
        </div>
      </aside>
      <main className="bo-main">{children}</main>
    </div>
  );
}
