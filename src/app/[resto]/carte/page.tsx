import { notFound } from 'next/navigation';
import { appOuverte } from '@/lib/ouverture';
import { Entete } from '@/components/Entete';
import { OngletsCarte } from '@/components/OngletsCarte';
import { versOnglet } from '@/lib/types';
import { getCarte, getRestaurant } from '@/lib/donnees';

export default async function Carte({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  if (!(await appOuverte(resto))) return null; // fermé au public : le layout affiche la page d'attente
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
