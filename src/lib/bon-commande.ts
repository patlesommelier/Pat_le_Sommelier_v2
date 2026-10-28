// Bon de commande de vin (PDF) : le restaurant, son fournisseur, les vins et les bouteilles commandées.
// Fonction pure (sans base de données) : utilisée pour le téléchargement et pour la pièce jointe de l'e-mail.
import { couper, DocumentPdf } from './pdf-simple';

export interface Coordonnees { nom: string; adresse?: string | null; tva?: string | null; contact?: string | null; telephone?: string | null; email?: string | null }
export interface LigneBon { libelle: string; detail?: string | null; quantite: number }
export interface BonCommande { numero: number; date: Date; restaurant: Coordonnees; fournisseur: Coordonnees; lignes: LigneBon[] }

const BORDEAUX = '#680021', DISCRET = '#6F6366', LIGNE = '#E2D5D1';

export const referenceCommande = (b: { numero: number; date: Date }) => `${b.date.getFullYear()}-${String(b.numero).padStart(3, '0')}`;

export function genererBonCommande(b: BonCommande): Uint8Array {
  const d = new DocumentPdf();
  const marge = 50, droite = d.largeurPage - marge, largeurUtile = droite - marge;
  let y = 64;

  // En-tête : restaurant à gauche, référence et date à droite.
  d.texte(marge, y, b.restaurant.nom, { corps: 18, gras: true, couleur: BORDEAUX });
  d.texte(droite, y - 4, 'BON DE COMMANDE', { corps: 9, gras: true, couleur: DISCRET, aligne: 'droite' });
  d.texte(droite, y + 12, `N° ${referenceCommande(b)}`, { corps: 12, gras: true, aligne: 'droite' });
  d.texte(droite, y + 27, b.date.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' }), { corps: 10, couleur: DISCRET, aligne: 'droite' });
  y += 46;
  d.trait(marge, y, droite, y, BORDEAUX, 1.2);
  y += 26;

  // Deux blocs : commandé par / fournisseur.
  const bloc = (x: number, titre: string, c: Coordonnees) => {
    let yy = y;
    d.texte(x, yy, titre, { corps: 8, gras: true, couleur: DISCRET }); yy += 15;
    d.texte(x, yy, c.nom, { corps: 11, gras: true }); yy += 14;
    const lignes = [
      ...(c.adresse ? c.adresse.split(/\n|,\s*(?=\d{4})/).map((l) => l.trim()).filter(Boolean) : []),
      c.tva ? `TVA : ${c.tva}` : '', c.contact ? `Contact : ${c.contact}` : '', c.telephone ? `Tél. : ${c.telephone}` : '', c.email ?? '',
    ].filter(Boolean);
    for (const l of lignes) for (const morceau of couper(l, largeurUtile / 2 - 20, 9.5)) { d.texte(x, yy, morceau, { corps: 9.5 }); yy += 13; }
    return yy;
  };
  y = Math.max(bloc(marge, 'COMMANDÉ PAR', b.restaurant), bloc(marge + largeurUtile / 2 + 10, 'FOURNISSEUR', b.fournisseur)) + 22;

  // Tableau des vins.
  const colQuantite = droite;
  const entete = () => {
    d.rectangle(marge, y - 12, largeurUtile, 20, '#FBF5F2');
    d.texte(marge + 8, y + 1, 'VIN', { corps: 8, gras: true, couleur: DISCRET });
    d.texte(colQuantite - 8, y + 1, 'BOUTEILLES', { corps: 8, gras: true, couleur: DISCRET, aligne: 'droite' });
    y += 22;
  };
  entete();
  let total = 0;
  for (const l of b.lignes) {
    const titre = couper(l.libelle, largeurUtile - 110, 10.5, true);
    const detail = l.detail ? couper(l.detail, largeurUtile - 110, 9) : [];
    const hauteur = titre.length * 13 + detail.length * 12 + 10;
    if (y + hauteur > d.hauteurPage - 90) { d.nouvellePage(); y = 64; entete(); }
    titre.forEach((t, i) => d.texte(marge + 8, y + i * 13, t, { corps: 10.5, gras: true }));
    detail.forEach((t, i) => d.texte(marge + 8, y + titre.length * 13 + i * 12, t, { corps: 9, couleur: DISCRET }));
    d.texte(colQuantite - 8, y, String(l.quantite), { corps: 11, gras: true, aligne: 'droite' });
    y += hauteur;
    d.trait(marge, y - 6, droite, y - 6, LIGNE);
    total += l.quantite;
    y += 6;
  }
  d.texte(colQuantite - 8, y + 6, `Total : ${total} bouteille${total > 1 ? 's' : ''}`, { corps: 11, gras: true, couleur: BORDEAUX, aligne: 'droite' });
  y += 40;

  // Pied : demande de confirmation.
  if (y > d.hauteurPage - 110) { d.nouvellePage(); y = 64; }
  const confirmation = `Merci de confirmer la commande et la date de livraison${b.restaurant.email ? ` à ${b.restaurant.email}` : ''}${b.restaurant.telephone ? ` ou au ${b.restaurant.telephone}` : ''}.`;
  for (const l of couper(confirmation, largeurUtile, 10)) { d.texte(marge, y, l, { corps: 10 }); y += 14; }
  d.texte(marge, d.hauteurPage - 40, 'Bon de commande préparé avec Pat le sommelier', { corps: 8, couleur: DISCRET });
  return d.octets();
}
