import { notFound } from 'next/navigation';
import { appOuverte } from '@/lib/ouverture';
import { Entete, menuDe } from '@/components/Entete';
import { OngletsCarte } from '@/components/OngletsCarte';
import { versOnglet } from '@/lib/types';
import { getCarte, getRestaurant } from '@/lib/donnees';
import { tarifsDuRestaurant } from '@/lib/tarifs';
import { contenanceDuFormat, grouperMemeVin } from '@/lib/contenances';
import { titreCarte } from '@/lib/admin/intitule';

export default async function Carte({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string }> }) {
  const { resto } = await params;
  const { c } = await searchParams; // couleur ouverte (retour depuis la fiche d'un vin)
  if (!(await appOuverte(resto))) return null; // fermé au public : le layout affiche la page d'attente
  const restaurant = await getRestaurant(resto);
  if (!restaurant) notFound();
  const [vins, tarifs] = await Promise.all([getCarte(resto), tarifsDuRestaurant(resto)]);
  // Un vin en plusieurs contenances : une seule ligne (la bouteille, sinon la première), avec le prix de chacune.
  const parVin = grouperMemeVin(vins, (v) => v.format).map((g) => g.find((v) => contenanceDuFormat(v.format) === 'bouteille') ?? g[0]);
  const lignes = vins.filter((v) => parVin.includes(v))
    .map((v) => ({ ...versOnglet(v), ...titreCarte({ ...v, producteur: v.producteur_nom ?? v.producteur_texte }),
      tarifs: (tarifs.get(v.id) ?? []).map(({ code, prix }) => ({ code, prix })) }));

  return (
    <>
      {/* Carte choisie comme page d'arrivée : pas de flèche retour (le bouton « Menu » mène au menu). */}
      <Entete restaurant={restaurant} retour={restaurant.page_accueil === 'carte' ? undefined : menuDe(restaurant)} surLaCarte />
      <main className="defile">
        <div className="titre-page" style={{ padding: '24px 20px 12px' }}>
          <h1>Carte des vins</h1>
          <div className="filet" />
        </div>
        <OngletsCarte restaurant={resto} vins={lignes} couleur={c} categories={restaurant.categories_carte ?? []} />
      </main>
    </>
  );
}
