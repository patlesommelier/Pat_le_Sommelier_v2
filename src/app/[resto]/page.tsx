import Link from 'next/link';
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
  const restaurant = await getRestaurant(resto);
  if (!restaurant) notFound();
  const plats = await getPlats(resto);
  const [titre, sousTitre] = (restaurant.accroche ?? `Bienvenue chez ${restaurant.nom},|nous vous aidons à choisir votre vin`).split('|');

  return (
    <>
      <Entete restaurant={restaurant} grand>
        <div className="accueil-hero">
          <div className="accueil-texte">
            <div className="accueil-titre">
              {titre}
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
