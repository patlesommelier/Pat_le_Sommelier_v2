import { notFound } from 'next/navigation';
import { Coque } from '../Coque';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { etapesRestaurant } from './etapes';
import type { Etape } from '@/components/admin/Nav';


// Menu de gauche : chaque entrée avec son icône (celle des cadres du tableau de bord) ; les trois premières disent ce qu'on y fait.
const LIBELLES_MENU: Record<string, string> = { Menu: 'Gérer le menu', 'Carte des vins': 'Gérer la carte des vins', Accords: 'Gérer les accords mets/vins' };
const GROUPES_MENU: Record<string, string> = { 'Mise en place': 'Cartes et menus', Sommelier: 'Cartes et menus', App: 'App client' };
// « Base des vins » (vins, stocks, commandes, distributeurs) : sous « Cartes et menus » (règles du sommelier comprises), avant l'app client.
function avecStocks(resto: string, etapes: Etape[]): Etape[] {
  const base = `/admin/${resto}`;
  const stocks: Etape[] = [['stocks', 'Ma cave', 'stock'], ['trouver-vin', 'Trouver un vin', 'bottle'], ['commandes', 'Commandes', 'camion'], ['fournisseurs', 'Distributeurs', 'fournisseur']]
    .map(([chemin, libelle, icone]) => ({ href: `${base}/${chemin}`, libelle, etat: 'fait', groupe: 'Base des vins', icone }));
  // Paramètres du restaurant (coordonnées, stock bas, utilisateurs) : tout en bas du menu.
  const parametres: Etape = { href: `${base}/parametres`, libelle: 'Paramètres du restaurant', etat: 'fait', groupe: 'Restaurant', icone: 'reglages' };
  const app = etapes.findIndex((e) => e.groupe === 'App client');
  return [...(app < 0 ? [...etapes, ...stocks] : [...etapes.slice(0, app), ...stocks, ...etapes.slice(app)]), parametres];
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
