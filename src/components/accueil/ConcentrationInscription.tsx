'use client';
// Inscription : dès qu'on la commence (« Inscrire mon restaurant », ou un premier geste dans l'encart), l'écran se centre
// sur l'encart orange et le reste du site passe en grisé. Il se recentre quand l'encart change de taille (étape suivante,
// préparation des accords). Un clic sur le gris, ou Échap, rend la page normale.
import { useEffect, useState } from 'react';

export function ConcentrationInscription() {
  const [actif, setActif] = useState(false);

  useEffect(() => {
    const bulle = () => document.querySelector<HTMLElement>('[data-bulle-inscription]');
    const centrer = () => {
      const b = bulle();
      if (!b) return;
      const haute = b.getBoundingClientRect().height > window.innerHeight - 40;
      b.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: haute ? 'start' : 'center' });
    };
    const activer = () => { setActif(true); requestAnimationFrame(centrer); };
    // Lien vers l'encart (bouton du haut, barre du téléphone) : même si l'adresse contient déjà #demarrer.
    const surClic = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href="#demarrer"]');
      if (a) { e.preventDefault(); history.replaceState(null, '', '#demarrer'); activer(); }
    };
    // Premier geste dans l'encart (déposer un fichier, cliquer, écrire).
    const surGeste = (e: Event) => { if (bulle()?.contains(e.target as Node)) setActif((x) => { if (!x) requestAnimationFrame(centrer); return true; }); };
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') setActif(false); };
    document.addEventListener('click', surClic);
    document.addEventListener('pointerdown', surGeste, true);
    document.addEventListener('focusin', surGeste);
    document.addEventListener('dragenter', surGeste, true);
    document.addEventListener('keydown', surTouche);
    if (location.hash === '#demarrer') activer();
    return () => {
      document.removeEventListener('click', surClic);
      document.removeEventListener('pointerdown', surGeste, true);
      document.removeEventListener('focusin', surGeste);
      document.removeEventListener('dragenter', surGeste, true);
      document.removeEventListener('keydown', surTouche);
    };
  }, []);

  // Encart au-dessus du voile ; recentré quand sa hauteur change nettement (nouvelle étape, préparation, QR code).
  useEffect(() => {
    const b = document.querySelector<HTMLElement>('[data-bulle-inscription]');
    if (!b) return;
    b.style.position = 'relative';
    b.style.zIndex = actif ? '1001' : '';
    if (!actif) return;
    let hauteur = b.getBoundingClientRect().height;
    const suivre = new ResizeObserver(() => {
      const h = b.getBoundingClientRect().height;
      if (Math.abs(h - hauteur) > 40) {
        hauteur = h;
        const haute = h > window.innerHeight - 40;
        b.scrollIntoView({ behavior: 'smooth', block: haute ? 'start' : 'center' });
      }
    });
    suivre.observe(b);
    return () => suivre.disconnect();
  }, [actif]);

  if (!actif) return null;
  return <div aria-hidden="true" onClick={() => setActif(false)}
    style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(36, 31, 32, .62)', animation: 'voile-inscription .3s ease-out both' }}>
    <style>{'@keyframes voile-inscription { from { opacity: 0 } } @media (prefers-reduced-motion: reduce) { [aria-hidden] { animation: none !important } }'}</style>
  </div>;
}
