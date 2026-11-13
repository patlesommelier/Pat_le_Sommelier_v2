import { notFound } from 'next/navigation';
import { Coque } from '../Coque';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { commandesAVoir } from '@/lib/admin/stocks';
import { logoAffiche } from '@/lib/couleurs';
import { etapesRestaurant } from './etapes';
import type { Annonce, Etape } from '@/components/admin/Nav';
import { AvisRestaurant, type Avis } from '@/components/admin/AvisRestaurant';
import { requete } from '@/lib/db';
import { carteValidee, MESSAGE_CARTE_A_VALIDER, MESSAGE_IMPRESSION_A_VALIDER } from '@/lib/admin/prochaine-etape';


// Menu de gauche : chaque entrée avec son icône (celle des cadres du tableau de bord) ; les trois premières disent ce qu'on y fait.
const LIBELLES_MENU: Record<string, string> = { Menu: 'Gérer le menu', 'Carte des vins': 'Gérer la carte des vins', Accords: 'Gérer les accords mets/vins' };
const GROUPES_MENU: Record<string, string> = { 'Mise en place': 'Cartes et menus', Sommelier: 'Cartes et menus', App: 'App client' };
// « Gestion de cave » (Ma cave, Inventaire, Ajouter un vin, Commandes, Distributeurs) : sous « Cartes et menus ».
// Post-its qui expliquent le fonctionnement, aux visites qui suivent les premiers pas. Un seul à la fois : le plus petit numéro.
// `surPlace` : montré aussi sur la page visée ; `vuSur` : page dont l'ouverture le fait disparaître (sinon la page visée).
type Cle = 'chevalet' | 'stocks' | 'inventaire' | 'fournisseurs' | 'accords' | 'trouver-vin' | 'commandes' | 'pense-bete' | 'ajout';
const ANNONCES: Record<Cle, Annonce & { page: string }> = {
  // Le chevalet pas encore ouvert (la première visite, le guide des premiers pas le montre).
  chevalet: { page: 'chevalet', numero: 3, texte: 'Imprimez votre chevalet de table' },
  stocks: { page: 'stocks', numero: 4, texte: 'Gérez votre cave : classez vos vins et indiquez votre stock' },
  // Après « Gérez votre cave », avant les distributeurs (qui suivent le premier inventaire).
  inventaire: { page: 'inventaire', numero: 4.5, texte: 'Faites l’inventaire de vos bouteilles facilement sur votre mobile' },
  fournisseurs: { page: 'fournisseurs', numero: 5, texte: 'Configurez vos distributeurs de vin pour automatiser vos commandes, ou choisissez ceux de Quid Vinum pour bénéficier de leurs prix' },
  accords: { page: 'accords', numero: 7, texte: 'Quand vous ajoutez un plat, Pat prépare les accords pour celui-ci. Vous pouvez aussi régénérer tous les accords et changer la priorité des vins' },
  'trouver-vin': { page: 'trouver-vin', numero: 9, texte: 'Une fois qu’un distributeur a été ajouté, vous pouvez rajouter un de ses vins à la carte et lui passer des commandes qui viendront directement alimenter le stock' },
  // Montré aussi sur la page Commandes (on y arrive en envoyant la commande) ; s'arrête à la première livraison reçue.
  commandes: { page: 'commandes', numero: 10, texte: 'Quand les bouteilles de votre commande sont livrées, cliquez sur « Réception des bouteilles » : le stock se met à jour automatiquement', surPlace: true },
  // Sur l'entrée des accords (le bouton « Imprimer le pense-bête » y est) ; disparaît à la première impression.
  'pense-bete': { page: 'accords', numero: 11, texte: 'Imprimez la carte d’accords simplifiée pour votre personnel en salle : elle sera toujours à jour', surPlace: true, vuSur: 'accords/pense-bete' },
  ajout: { page: 'trouver-vin', numero: 12, texte: 'Ajoutez un vin à votre carte en le décrivant, en précisant le plat qu’il doit accompagner, ou en le choisissant dans le catalogue de vos distributeurs' },
};
/** Les post-its à montrer, posés sur leurs entrées du menu. */
function avecAnnonces(resto: string, etapes: Etape[], actives: Partial<Record<Cle, boolean>>): Etape[] {
  const base = `/admin/${resto}`;
  return etapes.map((e) => {
    const annonces = (Object.keys(ANNONCES) as Cle[]).filter((k) => actives[k] && e.href === `${base}/${ANNONCES[k].page}`)
      .map((k) => { const { page: _page, vuSur, ...a } = ANNONCES[k]; return { ...a, ...(vuSur ? { vuSur: `${base}/${vuSur}` } : {}) }; });
    return annonces.length ? { ...e, annonces } : e;
  });
}
function avecStocks(resto: string, etapes: Etape[], aVoir: number, cave: 'grisee' | 'nouvelle' | 'visible' = 'visible'): Etape[] {
  const base = `/admin/${resto}`;
  const stocks: Etape[] = [['stocks', 'Ma cave', 'stock'], ['inventaire', 'Faire l’inventaire', 'check'], ['trouver-vin', 'Ajouter un vin', 'bottle'], ['commandes', 'Commandes', 'camion'], ['fournisseurs', 'Distributeurs', 'fournisseur']]
    .map(([chemin, libelle, icone]) => ({ href: `${base}/${chemin}`, libelle, etat: 'fait', groupe: 'Gestion de cave', icone,
      // Commandes : pastille quand Quid Vinum a changé le statut d’une commande ou joint une facture depuis la dernière visite.
      ...(chemin === 'commandes' ? { notif: { n: aVoir, source: `${base}/commandes/notifications` } } : {}),
      ...(chemin === 'stocks' && cave === 'nouvelle' ? { nouveau: true } : {}),
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
  const cartes = etapes.filter((e) => e.groupe === 'Cartes et menus');
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
      etapes={avecAnnonces(resto, avecStocks(resto, etapesRestaurant(r, resume).map((e) => ({ href: e.href, libelle: LIBELLES_MENU[e.libelle] ?? e.libelle, etat: e.etat, groupe: GROUPES_MENU[e.groupe] ?? e.groupe, icone: e.icone })), aVoir, cave),
        {
          // Post-it 4 « Gérez votre cave » : restaurant inscrit seul, carte validée, cave pas encore ouverte.
          stocks: !u.admin && r.origine === 'inscription' && cave !== 'grisee' && !r.cave_annonce_fermee_le,
          // Post-it 5 « Configurez vos distributeurs » : premier inventaire enregistré, page Distributeurs pas encore ouverte.
          fournisseurs: !u.admin && cave !== 'grisee' && Boolean(r.inventaire_le) && !r.distributeurs_annonce_fermee_le,
          // Post-it 9 « Ajouter un vin, commander » : un distributeur ajouté, page Ajouter un vin pas encore ouverte.
          'trouver-vin': !u.admin && cave !== 'grisee' && r.a_distributeur && !r.commandes_annonce_fermee_le,
          // Post-it 10 « Livraison » : restaurant inscrit seul, une commande envoyée, aucune livraison encore reçue.
          commandes: !u.admin && r.origine === 'inscription' && cave !== 'grisee' && r.attend_livraison,
          // Post-it « Chevalet » (visites suivantes) : restaurant inscrit seul, page du chevalet pas encore ouverte.
          chevalet: !u.admin && r.origine === 'inscription' && !r.chevalet_annonce_fermee_le,
          // Post-it 7 « Accords » : page des accords pas encore ouverte.
          accords: !u.admin && !r.accords_annonce_fermee_le,
          // « Pense-bête » : restaurant inscrit seul, pense-bête jamais imprimé.
          'pense-bete': !u.admin && r.origine === 'inscription' && !r.pense_bete_annonce_fermee_le,
          // « Ajoutez un vin » : restaurant inscrit seul, cave ouverte, page Ajouter un vin pas encore ouverte.
          ajout: !u.admin && r.origine === 'inscription' && cave !== 'grisee' && !r.ajout_annonce_fermee_le,
          // « Faites l'inventaire » : restaurant inscrit seul, cave ouverte, jamais d'inventaire, page pas encore ouverte.
          inventaire: !u.admin && r.origine === 'inscription' && cave !== 'grisee' && !r.inventaire_le && !r.inventaire_annonce_fermee_le,
        })}>
      <AvisRestaurant resto={resto} avis={avis} />
      {children}
    </Coque>
  );
}
