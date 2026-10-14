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
 * Bandeau du haut : retour discret, logo, bouton « Carte des vins » (sur la carte des vins : bouton « Sommelier », qui ramène
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
                style={{ height: hauteurLogo(logo.ratio, grand), maxWidth: '100%', objectFit: 'contain', objectPosition: 'left center',
                  // bandeau d'accueil replié : la taille du logo des autres pages (carte des vins)
                  ['--logo-grand' as string]: `${hauteurLogo(logo.ratio, true)}px`, ['--logo-replie' as string]: `${hauteurLogo(logo.ratio, false)}px` }} />
            : <LogoPat nom={restaurant.nom} />}
        </Link>
        {surLaCarte ? (
          <Link href={`/${restaurant.id}?menu=1` /* choix des plats sans le grand bandeau d'accueil */} className="bouton-carte">
            <Couverts />
            <span>Sommelier</span>
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
      <span className="logo-pat-pastille"><img src="/pat/pat-avatar.svg" alt="" /></span>
      <span className="logo-pat-nom">{nom}</span>
    </span>
  );
}

/** Adresse du menu de l'app : la page d'accueil, sauf si le restaurant arrive sur la carte des vins. */
export const menuDe = (r: { id: string; page_accueil?: string }) => (r.page_accueil === 'carte' ? `/${r.id}?menu=1` : `/${r.id}`);
