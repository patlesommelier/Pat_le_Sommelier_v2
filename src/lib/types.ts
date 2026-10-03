export type Couleur = 'bulles' | 'blanc' | 'rose' | 'rouge' | 'orange' | 'doux';

export interface Restaurant {
  id: string;
  nom: string;
  couleur: string;
  couleur_claire: string;
  logo_url: string | null;
  logo_fonce_url?: string | null;
  accroche: string | null;
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
}

export const COULEURS: { id: Couleur; libelle: string }[] = [
  { id: 'bulles', libelle: 'Bulles' },
  { id: 'blanc', libelle: 'Blancs' },
  { id: 'rose', libelle: 'Rosés' },
  { id: 'rouge', libelle: 'Rouges' },
  { id: 'orange', libelle: 'Orange' },
  { id: 'doux', libelle: 'Doux' },
];
