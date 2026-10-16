'use client';
// Page d'accueil, sur ordinateur : en descendant vers l'inscription, le titre et le texte du haut s'écrasent au rythme
// du défilement, pour laisser à l'écran Pat, l'inscription et « Qui est Pat ? ». En remontant, ils se redéploient en entier.
import { useEffect, useRef, type ReactNode } from 'react';

export function TexteRepliable({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ordinateur = matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)');
    let hauteur = 0, image = 0;
    const mesurer = () => { el.style.height = ''; hauteur = el.scrollHeight; };
    const appliquer = () => {
      image = 0;
      if (!ordinateur.matches) { el.style.height = ''; el.style.opacity = ''; el.style.transform = ''; return; }
      if (!hauteur) mesurer();
      const p = Math.min(1, Math.max(0, window.scrollY / hauteur)); // 0 = déplié, 1 = écrasé
      el.style.height = `${hauteur * (1 - p)}px`;
      el.style.opacity = String(Math.max(0, 1 - p * 1.4));
      el.style.transform = `scaleY(${1 - p * 0.5})`;
    };
    const auDefilement = () => { if (!image) image = requestAnimationFrame(appliquer); };
    const auRedimensionnement = () => { mesurer(); appliquer(); };
    mesurer(); appliquer();
    window.addEventListener('scroll', auDefilement, { passive: true });
    window.addEventListener('resize', auRedimensionnement);
    ordinateur.addEventListener('change', auRedimensionnement);
    return () => {
      window.removeEventListener('scroll', auDefilement);
      window.removeEventListener('resize', auRedimensionnement);
      ordinateur.removeEventListener('change', auRedimensionnement);
      if (image) cancelAnimationFrame(image);
    };
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
