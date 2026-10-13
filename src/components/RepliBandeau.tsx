'use client';
// Accueil de l'app (choix des plats) : le grand bandeau se replie en une fine barre (logo, « Carte des vins ») dès que
// le client fait défiler vers les plats, et reste replié ensuite (il ne se redéplie pas en remontant : plus fluide).
import { useEffect } from 'react';

export function RepliBandeau() {
  useEffect(() => {
    const zone = document.querySelector<HTMLElement>('main.defile');
    const bandeau = document.querySelector<HTMLElement>('header.bandeau');
    if (!zone || !bandeau) return;
    const suivre = () => {
      // On ne replie que si la liste reste plus longue que l'écran une fois le bandeau replié.
      const hero = bandeau.querySelector<HTMLElement>('.accueil-hero')?.offsetHeight ?? 0;
      if (zone.scrollTop > 40 && zone.scrollHeight - zone.clientHeight > hero + 40) {
        bandeau.classList.add('replie');
        zone.removeEventListener('scroll', suivre); // une fois replié, il le reste
      }
    };
    zone.addEventListener('scroll', suivre, { passive: true });
    return () => { zone.removeEventListener('scroll', suivre); bandeau.classList.remove('replie'); };
  }, []);
  return null;
}
