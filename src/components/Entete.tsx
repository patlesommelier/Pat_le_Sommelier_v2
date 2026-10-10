import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Restaurant } from '@/lib/types';
import { logoAffiche } from '@/lib/couleurs';
import { Chevron, Couverts, Livre } from './Icones';

/** Hauteur du logo dans le bandeau : plus grande pour un logo carré ou rond que pour un logo en largeur. */
function hauteurLogo(ratio: number | null | undefined, grand: boolean) {
  if (ratio && ratio < 1.8) return grand ? 104 : 62;
  return grand ? 73 : 50;
}


/**
 * Bandeau du haut : retour discret, logo, bouton « Carte des vins » (sur la carte des vins : bouton « Menu », qui ramène
 * au choix des plats). Reste visible quand on fait défiler.
 */
export function Entete({ restaurant, retour, grand = false, surLaCarte = false, children }: {
  restaurant: Restaurant; retour?: string; grand?: boolean; surLaCarte?: boolean; children?: ReactNode;
}) {
  const logo = logoAffiche(restaurant);
  return (
    <header className={`bandeau${grand ? ' grand' : ''}`}>
      <div className="bandeau-haut">
        {retour && (
          <Link href={retour} className="retour" aria-label="Retour">
            <Chevron />
          </Link>
        )}
        <Link href={`/${restaurant.id}`} className="logo" aria-label={`${restaurant.nom}, accueil`}>
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo.url} alt={restaurant.nom}
                style={{ height: hauteurLogo(logo.ratio, grand), maxWidth: '100%', objectFit: 'contain', objectPosition: 'left center' }} />
            : <LogoPat nom={restaurant.nom} />}
        </Link>
        {surLaCarte ? (
          <Link href={`/${restaurant.id}`} className="bouton-carte">
            <Couverts />
            <span>Menu</span>
          </Link>
        ) : (
          <Link href={`/${restaurant.id}/carte`} className="bouton-carte">
            <Livre />
            <span>Carte des vins</span>
          </Link>
        )}
      </div>
      {children}
    </header>
  );
}

/** En attendant le logo du restaurant (ajouté dans « Apparence ») : Pat dans sa pastille crème, et le nom du restaurant. */
export function LogoPat({ nom }: { nom: string }) {
  return (
    <span className="logo-pat">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span className="logo-pat-pastille"><img src="/pat/pat.png" alt="" /></span>
      <span className="logo-pat-nom">{nom}</span>
    </span>
  );
}
