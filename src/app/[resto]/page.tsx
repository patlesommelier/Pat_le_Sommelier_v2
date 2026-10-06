import Link from 'next/link';
import { appOuverte } from '@/lib/ouverture';
import { notFound } from 'next/navigation';
import { Entete } from '@/components/Entete';
import { Silhouettes } from '@/components/Icones';
import { getPlats, getRestaurant } from '@/lib/donnees';
import type { Plat } from '@/lib/types';

const GROUPES: { titre: string; categories: Plat['categorie'][] }[] = [
  { titre: 'Entrées', categories: ['entree'] },
  { titre: 'Plats', categories: ['plat'] },
  { titre: 'Desserts et fromages', categories: ['dessert', 'fromage'] },
];

export default async function Accueil({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  if (!(await appOuverte(resto))) return null; // fermé au public : le layout affiche la page d'attente
  const restaurant = await getRestaurant(resto);
  if (!restaurant) notFound();
  const plats = await getPlats(resto);
  const [brut, sousTitre] = (restaurant.accroche ?? `Bienvenue chez ${restaurant.nom},|nous vous aidons à choisir votre vin`).split('|');
  // Typographie française : espace insécable avant « ! ? : ; » (jamais seuls en début de ligne).
  const titre = brut.trim().replace(/\s+([!?:;])/g, '\u202F$1');
  // Titre sur une seule ligne : la taille diminue un peu pour un nom long (27 px au plus).
  const tailleTitre = `min(27px, calc((100vw - 40px) / ${(titre.length * 0.56).toFixed(2)}))`;

  return (
    <>
      <Entete restaurant={restaurant} grand>
        <div className="accueil-hero">
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
      </Entete>
      <main className="defile">
        <div className="contenu" style={{ padding: '22px 16px 20px', gap: 18 }}>
          {GROUPES.map((g) => {
            const liste = plats.filter((p) => g.categories.includes(p.categorie));
            if (!liste.length) return null;
            return (
              <section key={g.titre} className="boite" aria-label={g.titre}>
                <div className="titre-section">
                  <span>{g.titre}</span>
                  <div className="filet court" />
                </div>
                <div className="bulles">
                  {liste.map((p) => (
                    <Link key={p.id} href={`/${resto}/plat/${p.id}`} className="bulle" title={p.nom}>
                      {p.nom_court ?? p.nom}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
