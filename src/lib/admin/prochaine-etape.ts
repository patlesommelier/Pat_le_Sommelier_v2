// Tableau de bord : « Votre prochaine étape », une seule chose à faire maintenant, la plus urgente d'abord.
// Choix pur (sans base de données) : testé seul ; les compteurs sont lus par la page.

export interface EtatRestaurant {
  /** Commandes dont Quid Vinum a changé le statut ou joint une facture depuis la dernière visite. */
  commandesAVoir: number;
  /** Accords préparés par Pat, pas encore relus. */
  accordsARelire: number;
  /** Vins de la carte sans aucun prix (ni bouteille ni verre). */
  vinsSansPrix: number;
  /** Gestion de cave visible (après le premier client pour un restaurant inscrit seul). */
  cave: boolean;
  /** Vins en stock bas (compté seulement après un premier inventaire). */
  vinsStockBas: number;
  /** Inventaire jamais fait, ou plus vieux que 7 jours ; et le restaurant a des vins. */
  inventaireARefaire: boolean;
  /** Depuis quand date le dernier inventaire (« il y a 9 jours ») ; null : jamais fait. */
  inventaireIlYA: string | null;
  /** Apparence de l'app jamais choisie. */
  apparenceAChoisir: boolean;
}

export interface ProchaineEtape { titre: string; texte: string; bouton: string; chemin: string }

const pl = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;

/** La prochaine étape du restaurant, ou null quand tout est à jour. `chemin` est relatif à /admin/<resto>. */
export function prochaineEtape(e: EtatRestaurant): ProchaineEtape | null {
  if (e.commandesAVoir > 0) return {
    titre: e.commandesAVoir > 1 ? 'Vos commandes ont avancé' : 'Une de vos commandes a avancé',
    texte: 'Quid Vinum a mis à jour son statut ou joint une facture.', bouton: 'Voir mes commandes', chemin: '/commandes' };
  if (e.accordsARelire > 0) return {
    titre: `Relire ${pl(e.accordsARelire, 'accord')} de Pat`,
    texte: 'Vos clients ne voient un accord qu’une fois que vous l’avez validé.', bouton: 'Relire les accords', chemin: '/accords' };
  if (e.vinsSansPrix > 0) return {
    titre: e.vinsSansPrix > 1 ? `${e.vinsSansPrix} vins n’ont pas de prix` : 'Un vin n’a pas de prix',
    texte: `Ajoutez ${e.vinsSansPrix > 1 ? 'leur prix' : 'son prix'} sur la carte des vins : vos clients le verront dans l’app.`, bouton: 'Compléter la carte', chemin: '/carte' };
  if (e.cave && e.vinsStockBas > 0) return {
    titre: `${pl(e.vinsStockBas, 'vin')} en stock bas`,
    texte: 'Commandez-les avant d’en manquer.', bouton: 'Voir les vins à commander', chemin: '/stocks?filtre=bas' };
  if (e.cave && e.inventaireARefaire) return {
    titre: e.inventaireIlYA ? `Dernier inventaire ${e.inventaireIlYA}` : 'Faites votre premier inventaire',
    texte: 'Comptez vos bouteilles pour garder votre stock à jour : alertes de stock bas et commandes au plus juste.', bouton: 'Faire l’inventaire', chemin: '/inventaire' };
  if (e.apparenceAChoisir) return {
    titre: 'Choisir l’apparence de votre app', texte: 'Votre logo, votre couleur et le style que verront vos clients.', bouton: 'Choisir l’apparence', chemin: '/apparence' };
  return null;
}

/** Gestion de cave visible : toujours, sauf pour un restaurant inscrit seul qui n'a encore eu ni client ni inventaire. */
export const caveVisible = (r: { origine: string; premier_client_le: string | null; inventaire_le: string | null }) =>
  r.origine !== 'inscription' || Boolean(r.inventaire_le) || Boolean(r.premier_client_le);
