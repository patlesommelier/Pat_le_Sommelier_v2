import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { BarrePat } from '@/components/BarrePat';
import { couleurClaire } from '@/lib/couleurs';
import { getRestaurant } from '@/lib/donnees';
import { appOuverte } from '@/lib/ouverture';
import { requete } from '@/lib/db';
import { reparerLogo } from '@/lib/logo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ resto: string }> }) {
  const r = await getRestaurant((await params).resto);
  return { title: r ? `${r.nom} · Pat le sommelier` : 'Pat le sommelier' };
}

export default async function LayoutRestaurant({ children, params }: { children: React.ReactNode; params: Promise<{ resto: string }> }) {
  const restaurant = await getRestaurant((await params).resto);
  if (!restaurant) notFound();
  // Logo d'un restaurant inscrit déposé avant le recadrage automatique : rogné et mesuré une fois.
  if (restaurant.logo_url && restaurant.logo_ratio == null && restaurant.origine === 'inscription') await reparerLogo(restaurant.id, restaurant.logo_url);
  const clair = couleurClaire(restaurant.couleur);
  // Sur une couleur claire, le bandeau écrit en foncé ; les textes « couleur de marque » sur fond blanc aussi.
  const theme = {
    '--marque': restaurant.couleur, '--marque-claire': restaurant.couleur_claire,
    '--sur-marque': clair ? '#1A1A1A' : '#FFFFFF', '--marque-texte': clair ? '#1A1A1A' : restaurant.couleur,
  } as CSSProperties;
  // Pas encore en service (ou suspendu) : page d'attente pour les clients ; chaque page vérifie aussi (rendu en parallèle).
  if (!(await appOuverte(restaurant.id))) {
    return (
      <div className="ecran" style={theme}>
        <main style={{ minHeight: '70dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, textAlign: 'center' }}>
          {/* Page blanche : le logo foncé s'y lit mieux, s'il existe. */}
          {restaurant.logo_fonce_url || restaurant.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={(restaurant.logo_fonce_url || restaurant.logo_url)!} alt={restaurant.nom} style={{ maxWidth: 180, maxHeight: 110, objectFit: 'contain' }} />
            : <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--marque-texte)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="logo-pat-pastille" style={{ width: 88, height: 88 }}><img src="/pat/pat.png" alt="" /></span>{restaurant.nom}</h1>}
          <p style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{restaurant.statut === 'suspendu' ? 'La carte des vins de Pat est momentanément indisponible.' : 'La carte des vins de Pat arrive très bientôt.'}</p>
          <p style={{ fontSize: 15, margin: 0, opacity: 0.75 }}>En attendant, demandez conseil à l’équipe : elle se fera un plaisir de vous guider.</p>
        </main>
      </div>
    );
  }
  // Première ouverture de l'app (le QR code vient d'être scanné) : notée une seule fois.
  await requete('update restaurant set premier_scan_le = now() where id = $1 and premier_scan_le is null', [restaurant.id]);
  return (
    <div className="ecran" style={theme}>
      {children}
      <BarrePat restaurant={restaurant.id} nom={restaurant.nom} />
    </div>
  );
}
