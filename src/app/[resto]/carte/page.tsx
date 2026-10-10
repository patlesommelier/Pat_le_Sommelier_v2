import { notFound } from 'next/navigation';
import { appOuverte } from '@/lib/ouverture';
import { Entete } from '@/components/Entete';
import { OngletsCarte } from '@/components/OngletsCarte';
import { versOnglet } from '@/lib/types';
import { getCarte, getRestaurant } from '@/lib/donnees';
import { tarifsDuRestaurant } from '@/lib/tarifs';
import { cleMemeVin, contenanceDuFormat } from '@/lib/contenances';

export default async function Carte({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string }> }) {
  const { resto } = await params;
  const { c } = await searchParams; // couleur ouverte (retour depuis la fiche d'un vin)
  if (!(await appOuverte(resto))) return null; // fermé au public : le layout affiche la page d'attente
  const restaurant = await getRestaurant(resto);
  if (!restaurant) notFound();
  const [vins, tarifs] = await Promise.all([getCarte(resto), tarifsDuRestaurant(resto)]);
  // Un vin en plusieurs contenances : une seule ligne (la bouteille, sinon la première), avec le prix de chacune.
  const vus = new Set<string>();
  const parVin = [...vins].sort((a, b) => Number(contenanceDuFormat(b.format) === 'bouteille') - Number(contenanceDuFormat(a.format) === 'bouteille'))
    .filter((v) => !vus.has(cleMemeVin(v)) && vus.add(cleMemeVin(v)));
  const lignes = vins.filter((v) => parVin.includes(v))
    .map((v) => ({ ...versOnglet(v), tarifs: (tarifs.get(cleMemeVin(v)) ?? []).map(({ code, prix }) => ({ code, prix })) }));

  return (
    <>
      <Entete restaurant={restaurant} retour={`/${resto}`} surLaCarte />
      <main className="defile">
        <div className="titre-page" style={{ padding: '24px 20px 12px' }}>
          <h1>Carte des vins</h1>
          <div className="filet" />
        </div>
        <OngletsCarte restaurant={resto} vins={lignes} couleur={c} />
      </main>
    </>
  );
}
