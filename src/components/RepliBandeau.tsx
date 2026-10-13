'use client';
// Accueil de l'app (choix des plats) : le grand bandeau se replie en une fine barre (logo, « Carte des vins ») dès que
// le client fait défiler vers les plats, et se déplie quand il remonte tout en haut. Plus de place pour les plats sur téléphone.
import { useEffect } from 'react';

export function RepliBandeau() {
  useEffect(() => {
    const zone = document.querySelector<HTMLElement>('main.defile');
    const bandeau = document.querySelector<HTMLElement>('header.bandeau');
    if (!zone || !bandeau) return;
    // Seuils différents pour replier et déplier : le changement de hauteur du bandeau ne fait pas osciller.
    // On ne replie que si la liste reste plus longue que l'écran une fois le bandeau replié (sinon il se déplierait aussitôt).
    const suivre = () => {
      const hero = bandeau.querySelector<HTMLElement>('.accueil-hero')?.offsetHeight ?? 0;
      const assezLong = zone.scrollHeight - zone.clientHeight > hero + 40;
      if (zone.scrollTop > 40 && (assezLong || bandeau.classList.contains('replie'))) bandeau.classList.add('replie');
      else if (zone.scrollTop < 4) bandeau.classList.remove('replie');
    };
    zone.addEventListener('scroll', suivre, { passive: true });
    return () => { zone.removeEventListener('scroll', suivre); bandeau.classList.remove('replie'); };
  }, []);
  return null;
}
