-- Pat le sommelier — migration 0010 : « le mot de Pat », une phrase par vin pour la carte des vins imprimée
-- mot_pat       : phrase générée par Pat (npm run mots) ;
-- mot_pat_perso : phrase corrigée par le restaurant dans le back-office, prioritaire sur mot_pat.
-- L'import des fichiers ne touche pas ces deux champs.
alter table vin_carte add column if not exists mot_pat text;
alter table vin_carte add column if not exists mot_pat_perso text;
