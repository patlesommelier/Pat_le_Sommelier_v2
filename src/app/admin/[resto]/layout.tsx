import { notFound } from 'next/navigation';
import { Coque } from '../Coque';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { commandesAVoir } from '@/lib/admin/stocks';
import { logoAffiche } from '@/lib/couleurs';
import { etapesRestaurant } from './etapes';
import type { Etape } from '@/components/admin/Nav';
import { AvisRestaurant, type Avis } from '@/components/admin/AvisRestaurant';
import { requete } from '@/lib/db';
import { carteValidee, MESSAGE_CARTE_A_VALIDER, MESSAGE_IMPRESSION_A_VALIDER } from '@/lib/admin/prochaine-etape';


// Menu de gauche : chaque entrée avec son icône (celle des cadres du tableau de bord) ; les trois premières disent ce qu'on y fait.
const LIBELLES_MENU: Record<string, string> = { Menu: 'Gérer le menu', 'Carte des vins': 'Gérer la carte des vins', Accords: 'Gérer les accords mets/vins' };
const GROUPES_MENU: Record<string, string> = { 'Mise en place': 'Cartes et menus', Sommelier: 'Cartes et menus', App: 'App client' };
// « Gestion de cave » (Ma cave, Inventaire, Ajouter un vin, Commandes, Distributeurs) : sous « Cartes et menus ».
// Post-its qui expliquent le fonctionnement : 4 « Gérez votre cave » (cave qui vient de s'ouvrir), 5 « Configurez vos
// distributeurs » (après le premier inventaire), 7 « Accords ». Un seul à la fois : le plus petit numéro.
const ANNONCES = {
  accords: { numero: 7, texte: 'Quand vous ajoutez un plat, Pat prépare les accords pour celui-ci. Vous pouvez aussi régénérer tous les accords et changer la priorité des vins' },
  stocks: { numero: 4, texte: 'Gérez votre cave : classez vos vins et indiquez votre stock' },
  'trouver-vin': { numero: 9, texte: 'Une fois qu’un distributeur a été ajouté, vous pouvez rajouter un de ses vins à la carte et lui passer des commandes qui viendront directement alimenter le stock' },
  // Montré aussi sur la page Commandes (on y arrive en envoyant la commande) ; s'arrête à la première livraison reçue.
  commandes: { numero: 10, texte: 'Quand les bouteilles de votre commande sont livrées, cliquez sur « Réception des bouteilles » : le stock se met à jour automatiquement', surPlace: true },
  fournisseurs: { numero: 5, texte: 'Configurez vos distributeurs de vin pour automatiser vos commandes, ou choisissez ceux de Quid Vinum pour bénéficier de leurs prix' },
} as const;
function avecStocks(resto: string, etapes: Etape[], aVoir: number, cave: 'grisee' | 'nouvelle' | 'visible' = 'visible', annonces: { stocks?: boolean; fournisseurs?: boolean; accords?: boolean; 'trouver-vin'?: boolean; commandes?: boolean } = {}): Etape[] {
  const base = `/admin/${resto}`;
  const stocks: Etape[] = [['stocks', 'Ma cave', 'stock'], ['inventaire', 'Faire l’inventaire', 'check'], ['trouver-vin', 'Ajouter un vin', 'bottle'], ['commandes', 'Commandes', 'camion'], ['fournisseurs', 'Distributeurs', 'fournisseur']]
    .map(([chemin, libelle, icone]) => ({ href: `${base}/${chemin}`, libelle, etat: 'fait', groupe: 'Gestion de cave', icone,
      // Commandes : pastille quand Quid Vinum a changé le statut d’une commande ou joint une facture depuis la dernière visite.
      ...(chemin === 'commandes' ? { notif: { n: aVoir, source: `${base}/commandes/notifications` } } : {}),
      ...(chemin === 'stocks' && cave === 'nouvelle' ? { nouveau: true } : {}),
      ...((chemin === 'stocks' || chemin === 'fournisseurs' || chemin === 'trouver-vin' || chemin === 'commandes') && annonces[chemin] ? { annonce: ANNONCES[chemin] } : {}),
      // Carte pas encore validée par Quid Vinum : grisé, avec le message (la page « Ajouter un vin » reste ouverte depuis la
      // carte des vins, pour la compléter).
      ...(cave === 'grisee' ? { desactive: MESSAGE_CARTE_A_VALIDER } : {}) }));
  // Paramètres du restaurant (coordonnées, stock bas, inventaire, utilisateurs) : tout en bas du menu, seul (sans groupe à dérouler).
  const parametres: Etape = { href: `${base}/parametres`, libelle: 'Paramètres du restaurant', etat: 'fait', icone: 'reglages' };
  // Centre d'impression (logo et couleur des impressions, menu, suggestions, carte des vins) : entre l'app client et les paramètres.
  const impression: Etape = { href: `${base}/impression`, libelle: 'Impression de la carte des vins', etat: 'fait', groupe: 'Centre d’impression', icone: 'imprimante',
    ...(cave === 'grisee' ? { desactive: MESSAGE_IMPRESSION_A_VALIDER } : {}) };
  const chevalet: Etape = { href: `${base}/chevalet`, libelle: 'Impression du chevalet', etat: 'fait', groupe: 'Centre d’impression', icone: 'qr' };
  // Cartes et menus d'abord (juste après le tableau de bord), puis Gestion de cave, puis l'app client et les paramètres.
  const cartes = etapes.filter((e) => e.groupe === 'Cartes et menus')
    .map((e) => (annonces.accords && e.href === `${base}/accords` ? { ...e, annonce: ANNONCES.accords } : e));
  return [...cartes, ...stocks, ...etapes.filter((e) => e.groupe !== 'Cartes et menus'), impression, chevalet, parametres];
}

export default async function LayoutRestaurant({ children, params }: { children: React.ReactNode; params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  const u = await exigerAcces(resto);
  const [r, resume, aVoir, avis] = await Promise.all([getRestaurantBO(resto), getResume(resto), u.admin ? 0 : commandesAVoir(resto),
    // Avis de Quid Vinum pas encore fermés par le restaurant (pas montrés au super-admin, qui ne doit pas les fermer à sa place).
    u.admin ? [] : requete<Avis>('select id, titre, texte, lien, lien_libelle, forme from avis_restaurant where restaurant_id = $1 and lu_le is null order by cree_le', [resto])]);
  if (!r) notFound();
  // Restaurant inscrit seul : Gestion de cave et impression de la carte grisées tant que Quid Vinum n'a pas validé sa carte ;
  // « Nouveau » à côté de Gestion de cave le jour qui suit cette validation. Le super-admin a tout (sans « Nouveau » avant validation).
  const cave = !carteValidee(r) ? (u.admin ? 'visible' : 'grisee')
    : r.origine === 'inscription' && r.carte_complete_le && Date.now() - Date.parse(r.carte_complete_le) < 864e5 ? 'nouvelle' : 'visible';
  return (
    <Coque utilisateur={u} mode={r.mode} resto={{ id: r.id, nom: r.nom, couleur: r.couleur, resume: `${resume.plats} plats · ${resume.vins} vins`, logo: logoAffiche(r)?.url ?? null }}
      etapes={avecStocks(resto, etapesRestaurant(r, resume).map((e) => ({ href: e.href, libelle: LIBELLES_MENU[e.libelle] ?? e.libelle, etat: e.etat, groupe: GROUPES_MENU[e.groupe] ?? e.groupe, icone: e.icone })), aVoir, cave,
        {
          // Post-it 4 « Gérez votre cave » : restaurant inscrit seul, carte validée, cave pas encore ouverte.
          stocks: !u.admin && r.origine === 'inscription' && cave !== 'grisee' && !r.cave_annonce_fermee_le,
          // Post-it 5 « Configurez vos distributeurs » : premier inventaire enregistré, page Distributeurs pas encore ouverte.
          fournisseurs: !u.admin && cave !== 'grisee' && Boolean(r.inventaire_le) && !r.distributeurs_annonce_fermee_le,
          // Post-it 9 « Ajouter un vin, commander » : un distributeur ajouté, page Ajouter un vin pas encore ouverte.
          'trouver-vin': !u.admin && cave !== 'grisee' && r.a_distributeur && !r.commandes_annonce_fermee_le,
          // Post-it 10 « Livraison » : restaurant inscrit seul, une commande envoyée, aucune livraison encore reçue.
          commandes: !u.admin && r.origine === 'inscription' && cave !== 'grisee' && r.attend_livraison,
          // Post-it 7 « Accords » : page des accords pas encore ouverte.
          accords: !u.admin && !r.accords_annonce_fermee_le,
        })}>
      <AvisRestaurant resto={resto} avis={avis} />
      {children}
    </Coque>
  );
}
