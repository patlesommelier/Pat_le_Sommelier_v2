import Link from 'next/link';
import { seDeconnecter } from '../actions';
import { NavSuper } from '@/components/admin/NavSuper';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Espace super-admin (Pat) : barre latérale foncée. La cuisine interne n'est lisible qu'ici. */
export default async function LayoutSuper({ children }: { children: React.ReactNode }) {
  const u = await exigerAdmin();
  const [{ n }] = await requete<{ n: number }>(`select count(*)::int as n from producteur where statut = 'propose'`);
  return (
    <div className="bo">
      <aside className="bo-nav sombre">
        <Link href="/admin/super" className="bo-marque">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pat/pat.png" alt="" />
          <span><strong>Pat le sommelier</strong><span>Super-admin</span></span>
        </Link>
        <NavSuper aValider={n} />
        <div className="bo-bas">
          <Link href="/admin" style={{ color: '#FFF' }}>Espace des restaurants →</Link>
          <span>{u.email}</span>
          <form action={seDeconnecter}><button type="submit" className="btn fantome petit" style={{ paddingLeft: 0 }}>Se déconnecter</button></form>
        </div>
      </aside>
      <main className="bo-main">{children}</main>
    </div>
  );
}
