'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icone } from './Icone';

const LIENS = [
  { href: '/admin/super', libelle: 'Restaurants', icone: 'home' },
  { href: '/admin/super/producteurs', libelle: 'Producteurs à valider', icone: 'users' },
  { href: '/admin/super/base', libelle: 'Base et rankings', icone: 'bottle' },
  { href: '/admin/super/principes', libelle: 'Principes de Pat', icone: 'menu' },
  { href: '/admin/super/regles', libelle: 'Règles par défaut', icone: 'sliders' },
];

/** Menu de l'espace super-admin (barre foncée). */
export function NavSuper({ aValider }: { aValider: number }) {
  const chemin = usePathname();
  const courant = (href: string) => (href === '/admin/super' ? chemin === href : chemin.startsWith(href)) ? 'page' : undefined;
  return (
    <nav aria-label="Super-admin" className="bo-liens">
      <div className="section">Super-admin</div>
      {LIENS.map((l) => (
        <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}>
          <span className="bo-num" style={{ border: 0 }}><Icone nom={l.icone} /></span>
          <span style={{ flexGrow: 1 }}>{l.libelle}</span>
          {l.href.endsWith('producteurs') && aValider > 0 && <b style={{ fontSize: 12.5 }}>{aValider}</b>}
        </Link>
      ))}
    </nav>
  );
}
