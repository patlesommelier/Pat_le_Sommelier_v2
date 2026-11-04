'use client';
// Pastille rouge du menu (ex. « Commandes 2 ») : nombre relu à chaque changement de page et toutes les minutes ;
// cachée sur la page concernée (le restaurant y voit déjà les changements).
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function PastilleNotif({ initial, source, page }: { initial: number; source: string; page: string }) {
  const chemin = usePathname();
  const [n, setN] = useState(initial);
  const ici = chemin.startsWith(page);
  useEffect(() => {
    if (ici) { setN(0); return; }
    let actif = true;
    const lire = () => fetch(source, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (actif && d) setN(Number(d.n) || 0); }).catch(() => {});
    lire();
    const t = setInterval(lire, 60_000);
    return () => { actif = false; clearInterval(t); };
  }, [chemin, ici, source]);
  if (ici || n <= 0) return null;
  return <span className="pastille-notif" aria-label={`${n} nouveauté${n > 1 ? 's' : ''}`}>{n > 9 ? '9+' : n}</span>;
}
