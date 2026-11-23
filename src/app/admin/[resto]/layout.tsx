import { aDesFrigos } from '@/lib/frigos/documents';
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
// Menu en deux parties, comme la page d'accueil de quidvinum.com : Pat le sommelier, puis Quid Vinum (la cave).
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
  // « Ajouter un vin » est un bouton de la carte des vins : ces post-its montrent la carte, puis, sur sa page, le bouton.
  'trouver-vin': { page: 'carte', surPlace: true, vuSur: 'trouver-vin', ancre: 'bouton-ajouter-vin', numero: 9, texte: 'Une fois qu’un distributeur a été ajouté, vous pouvez rajouter un de ses vins à la carte et lui passer des commandes qui viendront directement alimenter le stock' },
  // Montré aussi sur la page Commandes (on y arrive en envoyant la commande) ; s'arrête à la première livraison reçue.
  commandes: { page: 'commandes', numero: 10, texte: 'Quand les bouteilles de votre commande sont livrées, cliquez sur « Réception des bouteilles » : le stock se met à jour automatiquement', surPlace: true },
  // Montre l'entrée des accords ; sur la page des accords, se pose sous le bouton « Imprimer le pense-bête ». Disparaît à
  // la première impression.
  'pense-bete': { page: 'accords', numero: 11, texte: 'Imprimez la carte d’accords simplifiée pour votre personnel en salle : elle sera toujours à jour', surPlace: true, vuSur: 'accords/pense-bete', ancre: 'bouton-pense-bete' },
  ajout: { page: 'carte', surPlace: true, vuSur: 'trouver-vin', ancre: 'bouton-ajouter-vin', numero: 12, texte: 'Ajoutez un vin à votre carte en le décrivant, en précisant le plat qu’il doit accompagner, ou en le choisissant dans le catalogue de vos distributeurs' },
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
function avecStocks(resto: string, etapes: Etape[], aVoir: number, cave: 'grisee' | 'nouvelle' | 'visible' = 'visible', frigos = false): Etape[] {
  const base = `/admin/${resto}`;
  const page = (chemin: string) => etapes.find((e) => e.href === `${base}/${chemin}`);
  const pat = (e: Etape | undefined, groupe: string): Etape[] => (e ? [{ ...e, marque: 'pat', groupe }] : []);
  // Carte pas encore validée par Quid Vinum : Quid Vinum (la cave) grisé d'un bloc, et l'impression de la carte grisée, avec le
  // message au survol. « Ajouter un vin » n'est plus dans le menu : c'est un bouton de la carte des vins.
  const grise = (message: string) => (cave === 'grisee' ? { desactive: message } : {});
  // 1. Pat le sommelier : carte et menu, l'app client, l'impression.
  const carteEtMenu: Etape[] = [
    ...pat(page('menu'), 'Cartes et menus'), ...pat(page('carte'), 'Cartes et menus'),
    ...pat(page('accords'), 'Cartes et menus'),
    // Règles du sommelier : des curseurs (l'avatar de Pat est déjà sur l'en-tête de la partie).
    ...pat(page('regles') && { ...page('regles')!, icone: 'sliders' }, 'Cartes et menus'),
  ];
  const app = [...pat(page('simulateur'), 'App client'), ...pat(page('apparence'), 'App client'), ...pat(page('acces'), 'App client')];
  const impression: Etape[] = [
    { href: `${base}/impression`, libelle: 'Impression des cartes et menus', etat: 'fait', icone: 'imprimante', marque: 'pat', groupe: 'Impression', ...grise(MESSAGE_IMPRESSION_A_VALIDER) },
    { href: `${base}/chevalet`, libelle: 'Impression du chevalet', etat: 'fait', icone: 'qr', marque: 'pat', groupe: 'Impression' },
  ];
  // 2. Quid Vinum : la cave.
  const quidVinum: Etape[] = [['stocks', 'Ma cave', 'stock'], ['inventaire', 'Faire l’inventaire', 'check'], ['commandes', 'Commandes', 'camion'], ['fournisseurs', 'Distributeurs', 'fournisseur']]
    .map(([chemin, libelle, icone]) => ({ href: `${base}/${chemin}`, libelle, etat: 'fait' as const, icone, marque: 'qv' as const,
      // Commandes : pastille quand Quid Vinum a changé le statut d’une commande ou joint une facture depuis la dernière visite.
      ...(chemin === 'commandes' ? { notif: { n: aVoir, source: `${base}/commandes/notifications` } } : {}),
      ...(chemin === 'stocks' && cave === 'nouvelle' ? { nouveau: true } : {}),
      ...grise(MESSAGE_CARTE_A_VALIDER) }));
  // 3. Frigos connectés (WineMS, LVQNEP) : un onglet à droite de la Gestion de cave, seulement pour un restaurant qui en a.
  const frigo: Etape[] = frigos ? [['frigos', 'Mes frigos', 'bottle'], ['bons-frigo', 'Bons de commande', 'camion'], ['factures-frigo', 'Factures', 'download']]
    .map(([chemin, libelle, icone]) => ({ href: `${base}/${chemin}`, libelle, etat: 'fait' as const, icone, marque: 'qv' as const, groupe: 'Frigos connectés', ...grise(MESSAGE_CARTE_A_VALIDER) })) : [];
  // Paramètres du restaurant (coordonnées, stock bas, inventaire, utilisateurs) : tout en bas du menu, seul.
  const parametres: Etape = { href: `${base}/parametres`, libelle: 'Paramètres du restaurant', etat: 'fait', icone: 'reglages' };
  return [...carteEtMenu, ...app, ...impression, ...quidVinum, ...frigo, parametres];
}

export default async function LayoutRestaurant({ children, params }: { children: React.ReactNode; params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  const u = await exigerAcces(resto);
  const [r, resume, aVoir, avis, frigos] = await Promise.all([getRestaurantBO(resto), getResume(resto), u.admin ? 0 : commandesAVoir(resto),
    // Avis de Quid Vinum pas encore fermés par le restaurant (pas montrés au super-admin, qui ne doit pas les fermer à sa place).
    u.admin ? [] : requete<Avis>('select id, titre, texte, lien, lien_libelle, forme from avis_restaurant where restaurant_id = $1 and lu_le is null order by cree_le', [resto]), aDesFrigos(resto)]);
  if (!r) notFound();
  // Restaurant inscrit seul : Gestion de cave et impression de la carte grisées tant que Quid Vinum n'a pas validé sa carte ;
  // « Nouveau » à côté de Gestion de cave le jour qui suit cette validation. Le super-admin a tout (sans « Nouveau » avant validation).
  const cave = !carteValidee(r) ? (u.admin ? 'visible' : 'grisee')
    : r.origine === 'inscription' && r.carte_complete_le && Date.now() - Date.parse(r.carte_complete_le) < 864e5 ? 'nouvelle' : 'visible';
  return (
    <Coque utilisateur={u} mode={r.mode} resto={{ id: r.id, nom: r.nom, couleur: r.couleur, resume: `${resume.plats} plats · ${resume.vins} vins`, logo: logoAffiche(r)?.url ?? null }}
      etapes={avecAnnonces(resto, avecStocks(resto, etapesRestaurant(r, resume).map((e) => ({ href: e.href, libelle: LIBELLES_MENU[e.libelle] ?? e.libelle, etat: e.etat, groupe: GROUPES_MENU[e.groupe] ?? e.groupe, icone: e.icone })), aVoir, cave, frigos),
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
