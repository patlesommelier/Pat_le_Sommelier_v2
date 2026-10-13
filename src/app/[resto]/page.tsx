import { ChoixPlats } from '@/components/ChoixPlats';
import { RepliBandeau } from '@/components/RepliBandeau';
import { appOuverte } from '@/lib/ouverture';
import { notFound, redirect } from 'next/navigation';
import { Entete } from '@/components/Entete';
import { Silhouettes } from '@/components/Icones';
import { getPlats, getRestaurant } from '@/lib/donnees';
import type { Plat } from '@/lib/types';

const GROUPES: { titre: string; categories: Plat['categorie'][] }[] = [
  { titre: 'Suggestions', categories: ['suggestion'] },
  { titre: 'Entrées', categories: ['entree'] },
  { titre: 'Plats', categories: ['plat'] },
  { titre: 'Desserts et fromages', categories: ['dessert', 'fromage'] },
];

export default async function Accueil({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ menu?: string }> }) {
  const { resto } = await params;
  if (!(await appOuverte(resto))) return null; // fermé au public : le layout affiche la page d'attente
  const restaurant = await getRestaurant(resto);
  if (!restaurant) notFound();
  // Page d'arrivée choisie par le restaurant : la carte des vins (le bouton « Sommelier » ramène ici avec ?menu=1).
  if (restaurant.page_accueil === 'carte' && !(await searchParams).menu) redirect(`/${resto}/carte`);
  const plats = await getPlats(resto);
  const [brut, sousTitre] = (restaurant.accroche ?? `Bienvenue chez ${restaurant.nom},|nous vous aidons à choisir votre vin`).split('|');
  // Typographie française : espace insécable avant « ! ? : ; » (jamais seuls en début de ligne).
  const titre = brut.trim().replace(/\s+([!?:;])/g, '\u202F$1');
  // Titre sur une seule ligne : la taille diminue un peu pour un nom long (27 px au plus).
  const tailleTitre = `min(27px, calc((100vw - 40px) / ${(titre.length * 0.56).toFixed(2)}))`;

  return (
    <>
      <Entete restaurant={restaurant} grand />
      <RepliBandeau />
      <main className="defile">
        {/* Le haut de l'accueil fait partie de la page : il défile avec les plats, à la vitesse du doigt. */}
        <div className="accueil-hero bandeau-suite">
          <div className="accueil-texte">
            <div className="accueil-titre">
              <div style={{ fontSize: tailleTitre, whiteSpace: 'nowrap' }}>{titre}</div>
              <span>{sousTitre}</span>
            </div>
            <div className="filet-blanc" />
            <div className="accueil-question">Qu’allez-vous manger ?</div>
          </div>
          <Silhouettes />
        </div>
        <div className="contenu" style={{ padding: '22px 16px 20px', gap: 18 }}>
          <ChoixPlats resto={resto} groupes={GROUPES.map((g) => ({
            titre: g.titre,
            plats: plats.filter((p) => g.categories.includes(p.categorie)).map((p) => ({ id: p.id, nom: p.nom, court: p.nom_court ?? p.nom })),
          })).filter((g) => g.plats.length)} />
        </div>
      </main>
    </>
  );
}
