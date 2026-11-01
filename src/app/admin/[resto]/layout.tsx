import { notFound } from 'next/navigation';
import { Coque } from '../Coque';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { etapesRestaurant } from './etapes';
import type { Etape } from '@/components/admin/Nav';


// Menu de gauche : chaque entrée avec son icône (celle des cadres du tableau de bord) ; les trois premières disent ce qu'on y fait.
const LIBELLES_MENU: Record<string, string> = { Menu: 'Gérer le menu', 'Carte des vins': 'Gérer la carte des vins', Accords: 'Gérer les accords mets/vins' };
const GROUPES_MENU: Record<string, string> = { 'Mise en place': 'Cartes et menus', App: 'App client' };
// « Base des vins » (vins, stocks, commandes, fournisseurs) : en premier, au-dessus de « Cartes et menus ».
function avecStocks(resto: string, etapes: Etape[]): Etape[] {
  const base = `/admin/${resto}`;
  const stocks: Etape[] = [['stocks', 'Vins', 'stock'], ['commandes', 'Commandes de vin', 'camion'], ['fournisseurs', 'Distributeurs', 'fournisseur'], ['parametres', 'Paramètres', 'reglages']]
    .map(([chemin, libelle, icone]) => ({ href: `${base}/${chemin}`, libelle, etat: 'fait', groupe: 'Base des vins', icone }));
  return [...stocks, ...etapes];
}

export default async function LayoutRestaurant({ children, params }: { children: React.ReactNode; params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  const u = await exigerAcces(resto);
  const [r, resume] = await Promise.all([getRestaurantBO(resto), getResume(resto)]);
  if (!r) notFound();
  return (
    <Coque utilisateur={u} resto={{ id: r.id, nom: r.nom, couleur: r.couleur, resume: `${resume.plats} plats · ${resume.vins} vins` }}
      etapes={avecStocks(resto, etapesRestaurant(r, resume).map((e) => ({ href: e.href, libelle: LIBELLES_MENU[e.libelle] ?? e.libelle, etat: e.etat, groupe: GROUPES_MENU[e.groupe] ?? e.groupe, icone: e.icone })))}>
      {children}
    </Coque>
  );
}
