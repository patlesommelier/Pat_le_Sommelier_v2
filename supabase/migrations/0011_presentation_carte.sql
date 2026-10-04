-- Pat le sommelier — migration 0011 : la carte imprimée présente chaque vin en 3 à 4 lignes (3 phrases).
-- Les champs « mot de Pat » de la migration 0010 deviennent la présentation de la carte (contenu gardé).
-- presentation_carte       : présentation générée par Pat (npm run presentations) ;
-- presentation_carte_perso : présentation corrigée par le restaurant dans le back-office, prioritaire.
-- (vin_carte.presentation, déjà existant, reste la présentation du domaine venue des fichiers.)
alter table vin_carte rename column mot_pat to presentation_carte;
alter table vin_carte rename column mot_pat_perso to presentation_carte_perso;
