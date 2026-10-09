export type Couleur = 'bulles' | 'blanc' | 'rose' | 'rouge' | 'orange' | 'doux';

export interface Restaurant {
  id: string;
  nom: string;
  couleur: string;
  couleur_claire: string;
  logo_url: string | null;
  logo_fonce_url?: string | null;
  accroche: string | null;
  /** mise_en_place | en_service | suspendu : l'app n'est ouverte aux clients qu'« en service ». */
  statut?: string;
  origine?: string;
  /** Largeur / hauteur du logo (marges retirées) ; null = pas encore mesuré. */
  logo_ratio?: number | null;
  logo_fonce_ratio?: number | null;
  /** Logo choisi pour l'app : 'clair' ou 'fonce' ; null = automatique. */
  logo_choix?: string | null;
}

export interface Plat {
  id: string;
  nom: string;
  nom_court: string | null;
  categorie: 'entree' | 'plat' | 'dessert' | 'fromage';
  prix: number | null;
  prix_variantes: string | null;
}

export interface ProfilDegustation {
  douceur: number | null;
  acidite: number | null;
  corps: number | null;
  intensite: number | null;
  tanins: number | null;
  boise: number | null;
  effervescence: string | null;
  stade: string | null;
  aromes: string[];
}

export interface Vin {
  id: string;
  couleur: Couleur;
  section: string | null;
  libelle: string;
  producteur_texte: string | null;
  producteur_nom: string | null;
  producteur_avis_pat: string | null;
  producteur_ranking: number | null;
  appellation_nom: string | null;
  millesime: string | null;
  format: string;
  prix: number | null;
  prix_verre: number | null;
  cepages: string | null;
  profil_degustation: ProfilDegustation | null;
  descriptif: string | null;
  vin_texte: string | null;
  /** Appellation et nom du vin saisis dans le back-office (vides : déduits de vin_texte). */
  appellation_texte: string | null;
  nom_vin: string | null;
  presentation: string | null;
  resume_court: string | null;
  etiquette_url: string | null;
  coup_de_coeur: boolean;
  ordre: number;
  ranking_producteur: number | null;
  ranking_terroir: number | null;
  pays: string | null;
}

export interface Accord {
  plat_id: string;
  vin_id: string;
  note: number | null;
  rang: number | null;
  explication: string | null;
  explication_longue: string | null;
  service: string | null;
  statut: 'propose' | 'valide' | 'refuse';
  /** Commentaire réécrit par le restaurant : il remplace celui de Pat et n'est jamais régénéré. */
  commentaire_sommelier?: string | null;
}

export const COULEURS: { id: Couleur; libelle: string }[] = [
  { id: 'bulles', libelle: 'Bulles' },
  { id: 'blanc', libelle: 'Blancs' },
  { id: 'rose', libelle: 'Rosés' },
  { id: 'rouge', libelle: 'Rouges' },
  { id: 'orange', libelle: 'Orange' },
  { id: 'doux', libelle: 'Doux' },
];

/** Champs envoyés au navigateur : rien de la cuisine interne de Pat (rankings, avis). */
export type VinOnglet = Pick<Vin, 'id' | 'couleur' | 'section' | 'libelle' | 'producteur_nom' | 'producteur_texte' | 'cepages' | 'millesime' | 'format' | 'prix' | 'prix_verre' | 'etiquette_url'>
  /** Prix de chaque contenance du vin (bouteille, ½, ¼, magnum, verre). */
  & { tarifs?: Array<{ code: string; prix: number }> };
export const versOnglet = (v: Vin): VinOnglet => ({
  id: v.id, couleur: v.couleur, section: v.section, libelle: v.libelle, producteur_nom: v.producteur_nom, producteur_texte: v.producteur_texte,
  cepages: v.cepages, millesime: v.millesime, format: v.format, prix: v.prix, prix_verre: v.prix_verre, etiquette_url: v.etiquette_url,
});
