import Link from 'next/link';
import { seDeconnecter } from './actions';
import { quitterVueRestaurant } from './super/actions';
import { FilAriane, NavHaut, NavLiens, type Etape } from '@/components/admin/Nav';
import type { Utilisateur } from '@/lib/admin/auth';
import { MODES, type ModeRestaurant } from '@/lib/admin/prochaine-etape';

/** Coque du back-office : marque, restaurant, menu des étapes, déconnexion. */
export function Coque({ utilisateur, resto, etapes, mode, children }: {
  utilisateur: Utilisateur;
  resto?: { id: string; nom: string; couleur: string; resume: string; logo?: string | null };
  etapes: Etape[];
  /** Statut de l'espace du restaurant (vert actif, jaune inscription, rouge test) : montré sous le logo du restaurant. */
  mode?: string;
  children: React.ReactNode;
}) {
  const accueil = resto ? `/admin/${resto.id}` : '/admin';
  const admin = utilisateur.admin ? [{ href: '/admin/super', libelle: 'Super-admin' }] : [];
  const vue = utilisateur.vueRestaurant && (
    <form action={quitterVueRestaurant} className="bandeau-vue">
      <span>Aperçu côté restaurant : vous voyez l’espace exactement comme le restaurant, sans vos outils de super-admin.</span>
      <button type="submit">Quitter l’aperçu</button>
    </form>
  );
  // Espace d'un restaurant : menu en haut (onglets et menus déroulants), toute la largeur pour le contenu.
  if (resto) {
    const m = mode ? MODES[mode as ModeRestaurant] : undefined;
    return (
      <div className="bo bo-avec-haut">
        {vue}
        <NavHaut accueil={accueil} etapes={etapes} resto={resto} statut={m ? { couleur: m.couleur, libelle: m.libelle } : null}
          compte={{
            liens: [{ href: `${accueil}/parametres`, libelle: 'Paramètres du restaurant' }, ...admin,
              ...(utilisateur.admin || utilisateur.restaurants.length > 1 ? [{ href: '/admin', libelle: 'Changer de restaurant' }] : [])],
            email: utilisateur.email,
            deconnexion: <form action={seDeconnecter}><button type="submit" className="btn fantome petit">Se déconnecter</button></form>,
          }} />
        <main className="bo-main">
          <FilAriane accueil={accueil} etapes={etapes} />
          {children}
        </main>
      </div>
    );
  }
  return (
    <div className="bo">
      {vue}
      <aside className="bo-nav">
        <Link href="/admin" className="bo-marque">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/quidvinum/logo.png" alt="Quid Vinum" className="logo-qv" />
          <span className="sous-marque">Espace restaurant</span>
        </Link>
        {/* Sans restaurant (super-admin, choix du restaurant) : le menu de gauche. */}
        <NavLiens accueil="/admin" etapes={[]} admin={admin} />
        <div className="bo-bas">
          <span>{utilisateur.email}</span>
          <form action={seDeconnecter}><button type="submit" className="btn fantome petit" style={{ paddingLeft: 0 }}>Se déconnecter</button></form>
        </div>
      </aside>
      <main className="bo-main">{children}</main>
    </div>
  );
}
