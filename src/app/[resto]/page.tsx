import { ChoixPlats } from '@/components/ChoixPlats';
import { RepliBandeau } from '@/components/RepliBandeau';
import { appOuverte } from '@/lib/ouverture';
import { notFound, redirect } from 'next/navigation';
import { Entete } from '@/components/Entete';
import { PatEcrit } from '@/components/Icones';
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
  // ?menu=1 : on vient de la carte des vins (bouton « Sommelier ») : le choix des plats, sans le grand bandeau d'accueil.
  const compact = Boolean((await searchParams).menu);
  if (restaurant.page_accueil === 'carte' && !compact) redirect(`/${resto}/carte`);
  const plats = await getPlats(resto);
  const [brut, sousTitre] = (restaurant.accroche ?? `Bienvenue chez ${restaurant.nom},|je vous aide à choisir le vin`).split('|');
  // Typographie française : espace insécable avant « ! ? : ; » (jamais seuls en début de ligne).
  const titre = brut.trim().replace(/\s+([!?:;])/g, '\u202F$1');
  // Titre sur une seule ligne : la taille diminue un peu pour un nom long (27 px au plus).
  const tailleTitre = `min(27px, calc((100vw - 40px) / ${(titre.length * 0.56).toFixed(2)}))`;

  return (
    <>
      {/* Venu de la carte des vins (bouton « Sommelier ») : la flèche de retour y ramène, comme sur la carte. */}
      <Entete restaurant={restaurant} grand={!compact} retour={compact ? `/${resto}/carte` : undefined} />
      {!compact && <RepliBandeau />}
      <main className={`defile${compact ? '' : ' accueil-defile'}`}>
        {/* Le haut de l'accueil (bienvenue) défile avec les plats et s'efface en remontant ; « Qu'allez-vous manger ? », dans la
            couleur du bandeau, remonte jusque sous le logo et y reste : même bandeau que la carte des vins (« Que voulez-vous boire ? »). */}
        {!compact && (
        <div className="accueil-hero bandeau-suite">
          <div className="accueil-texte">
            <div className="accueil-titre">
              <div style={{ fontSize: tailleTitre, whiteSpace: 'nowrap' }}>{titre}</div>
              <span>{sousTitre}</span>
            </div>
            <div className="filet-blanc" />
          </div>
        </div>
        )}
        <p className="question-bandeau">Qu’allez-vous manger&#8239;?
          {/* « Pat » écrit, tout petit, posé au bord de la partie blanche (dans sa couleur) : le bandeau semble découpé à sa forme. */}
          {!compact && <PatEcrit />}</p>
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
