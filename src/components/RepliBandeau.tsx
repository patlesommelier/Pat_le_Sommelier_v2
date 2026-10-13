'use client';
// Accueil de l'app (choix des plats) : le titre et la question défilent avec la page ; le logo du bandeau rétrécit
// au même rythme jusqu'à la taille des autres pages (carte des vins), puis reste ainsi. Progression = défilement / hauteur du haut.
import { useEffect } from 'react';

export function RepliBandeau() {
  useEffect(() => {
    const zone = document.querySelector<HTMLElement>('main.defile');
    const bandeau = document.querySelector<HTMLElement>('header.bandeau');
    const haut = document.querySelector<HTMLElement>('.bandeau-suite');
    if (!zone || !bandeau || !haut) return;
    let image = 0;
    const suivre = () => {
      cancelAnimationFrame(image);
      image = requestAnimationFrame(() => {
        const p = Math.min(1, Math.max(0, zone.scrollTop / Math.max(1, haut.offsetHeight)));
        bandeau.style.setProperty('--repli', p.toFixed(3));
      });
    };
    suivre();
    zone.addEventListener('scroll', suivre, { passive: true });
    return () => { zone.removeEventListener('scroll', suivre); cancelAnimationFrame(image); bandeau.style.removeProperty('--repli'); };
  }, []);
  return null;
}
