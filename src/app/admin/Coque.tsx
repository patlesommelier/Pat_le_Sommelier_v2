import Link from 'next/link';
import { seDeconnecter } from './actions';
import { quitterVueRestaurant } from './super/actions';
import { NavLiens, type Etape } from '@/components/admin/Nav';
import type { Utilisateur } from '@/lib/admin/auth';

/** Coque du back-office : marque, restaurant, menu des étapes, déconnexion. */
export function Coque({ utilisateur, resto, etapes, children }: {
  utilisateur: Utilisateur;
  resto?: { id: string; nom: string; couleur: string; resume: string };
  etapes: Etape[];
  children: React.ReactNode;
}) {
  const accueil = resto ? `/admin/${resto.id}` : '/admin';
  const admin = utilisateur.admin ? [{ href: '/admin/super', libelle: 'Super-admin' }] : [];
  return (
    <div className="bo">
      {utilisateur.vueRestaurant && (
        <form action={quitterVueRestaurant} className="bandeau-vue">
          <span>Vous voyez l’espace exactement comme le restaurant (sans la cuisine interne de Pat).</span>
          <button type="submit">Revenir au super-admin</button>
        </form>
      )}
      <aside className="bo-nav">
        <Link href="/admin" className="bo-marque">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pat/pat.png" alt="" />
          <span><strong>Pat le sommelier</strong><span>Espace restaurant</span></span>
        </Link>
        {resto && (
          <Link href={utilisateur.admin || utilisateur.restaurants.length > 1 ? '/admin' : accueil} className="bo-resto" aria-label={`Restaurant ${resto.nom}${utilisateur.admin ? ' — changer de restaurant' : ''}`}>
            <span className="pastille" style={{ background: resto.couleur }}>{resto.nom.slice(0, 1)}</span>
            <span style={{ flexGrow: 1 }}><b>{resto.nom}</b><small>{resto.resume}</small></span>
          </Link>
        )}
        {resto ? <NavLiens accueil={accueil} etapes={etapes} admin={admin} supports={[{ href: `/admin/${resto.id}/supports`, libelle: 'Carte imprimable' }]} /> : <NavLiens accueil="/admin" etapes={[]} admin={admin} />}
        <div className="bo-bas">
          <span>{utilisateur.email}</span>
          <form action={seDeconnecter}><button type="submit" className="btn fantome petit" style={{ paddingLeft: 0 }}>Se déconnecter</button></form>
        </div>
      </aside>
      <main className="bo-main">{children}</main>
    </div>
  );
}
