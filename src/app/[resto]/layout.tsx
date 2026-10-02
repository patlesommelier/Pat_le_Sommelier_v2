import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { BarrePat } from '@/components/BarrePat';
import { getRestaurant } from '@/lib/donnees';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ resto: string }> }) {
  const r = await getRestaurant((await params).resto);
  return { title: r ? `${r.nom} · Pat le sommelier` : 'Pat le sommelier' };
}

export default async function LayoutRestaurant({ children, params }: { children: React.ReactNode; params: Promise<{ resto: string }> }) {
  const restaurant = await getRestaurant((await params).resto);
  if (!restaurant) notFound();
  const theme = { '--marque': restaurant.couleur, '--marque-claire': restaurant.couleur_claire } as CSSProperties;
  return (
    <div className="ecran" style={theme}>
      {children}
      <BarrePat restaurant={restaurant.id} />
    </div>
  );
}
