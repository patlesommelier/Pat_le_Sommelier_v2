'use client';
// Accueil de l'app (choix des plats) : le texte de bienvenue défile avec la page en s'effaçant ; le logo du bandeau rétrécit
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
        haut.style.setProperty('--repli', p.toFixed(3)); // le texte de bienvenue s'efface au même rythme
      });
    };
    suivre();
    zone.addEventListener('scroll', suivre, { passive: true });
    return () => { zone.removeEventListener('scroll', suivre); cancelAnimationFrame(image); bandeau.style.removeProperty('--repli'); haut.style.removeProperty('--repli'); };
  }, []);
  return null;
}
