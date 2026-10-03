import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Restaurant } from '@/lib/types';
import { couleurClaire } from '@/lib/couleurs';
import { Chevron, Livre } from './Icones';

/** Bandeau du haut : retour discret, logo, bouton « Carte des vins ». Reste visible quand on fait défiler. */
export function Entete({ restaurant, retour, grand = false, children }: { restaurant: Restaurant; retour?: string; grand?: boolean; children?: ReactNode }) {
  return (
    <header className={`bandeau${grand ? ' grand' : ''}`}>
      <div className="bandeau-haut">
        {retour && (
          <Link href={retour} className="retour" aria-label="Retour">
            <Chevron />
          </Link>
        )}
        <Link href={`/${restaurant.id}`} className="logo" aria-label={`${restaurant.nom}, accueil`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={(couleurClaire(restaurant.couleur) && restaurant.logo_fonce_url) || restaurant.logo_url || ''} alt={restaurant.nom} />
        </Link>
        <Link href={`/${restaurant.id}/carte`} className="bouton-carte">
          <Livre />
          <span>Carte des vins</span>
        </Link>
      </div>
      {children}
    </header>
  );
}
