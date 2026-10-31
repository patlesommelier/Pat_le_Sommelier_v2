'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icone } from './Icone';

const LIENS = [
  { href: '/admin/super', libelle: 'Restaurants', icone: 'home' },
  { href: '/admin/super/producteurs', libelle: 'Producteurs', icone: 'users' },
  { href: '/admin/super/vins', libelle: 'Vins de la base', icone: 'bottle' },
  { href: '/admin/super/appellations', libelle: 'Appellations', icone: 'lieu' },
  { href: '/admin/super/distributeurs', libelle: 'Distributeurs', icone: 'camion' },
  { href: '/admin/super/principes', libelle: 'Principes de Pat', icone: 'menu' },
  { href: '/admin/super/accords-reference', libelle: 'Accords de référence', icone: 'link' },
  { href: '/admin/super/utilisateurs', libelle: 'Utilisateurs de l’App', icone: 'users' },
  { href: '/admin/super/regles', libelle: 'Règles par défaut', icone: 'sliders' },
  { href: '/admin/super/wine-labs', libelle: 'Wine Labs', icone: 'bottle' },
  { href: '/admin/super/comparaison', libelle: 'Comparer les modèles', icone: 'sliders' },
];

/** Menu de l'espace super-admin (barre foncée). */
export function NavSuper({ aValider, appellationsAValider = 0 }: { aValider: number; appellationsAValider?: number }) {
  const chemin = usePathname();
  const courant = (href: string) => (href === '/admin/super' ? chemin === href : chemin.startsWith(href)) ? 'page' : undefined;
  return (
    <nav aria-label="Super-admin" className="bo-liens">
      <div className="section">Super-admin</div>
      {LIENS.map((l) => (
        <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}>
          <span className="bo-num" style={{ border: 0 }}><Icone nom={l.icone} /></span>
          <span style={{ flexGrow: 1 }}>{l.libelle}</span>
          {l.href.endsWith('producteurs') && aValider > 0 && <b style={{ fontSize: 12.5 }} title={`${aValider} à valider`}>{aValider}</b>}
          {l.href.endsWith('appellations') && appellationsAValider > 0 && <b style={{ fontSize: 12.5 }} title={`${appellationsAValider} à valider`}>{appellationsAValider}</b>}
        </Link>
      ))}
    </nav>
  );
}
