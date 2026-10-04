import { notFound } from 'next/navigation';
import { Entete } from '@/components/Entete';
import { OngletsCarte } from '@/components/OngletsCarte';
import { versOnglet } from '@/lib/types';
import { getCarte, getRestaurant } from '@/lib/donnees';

export default async function Carte({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  const restaurant = await getRestaurant(resto);
  if (!restaurant) notFound();
  const vins = await getCarte(resto);

  return (
    <>
      <Entete restaurant={restaurant} retour={`/${resto}`} />
      <main className="defile">
        <div className="titre-page" style={{ padding: '24px 20px 12px' }}>
          <h1>Carte des vins</h1>
          <div className="filet" />
        </div>
        <OngletsCarte restaurant={resto} vins={vins.map(versOnglet)} />
      </main>
    </>
  );
}
