-- Pat le sommelier — migration 0008 : commentaires d'accord générés (npm run commentaires)
-- explication          : la phrase montrée au client (positive, propre au vin) ; réécrite par le générateur.
-- limite               : ce qui empêche une note plus haute. Cuisine interne : affichée à Pat seulement,
--                        jamais au restaurant ni au client (aucun accès direct à la table depuis 0007).
-- explication_generee_le : date de génération ; l'import des fichiers ne remplace plus ces commentaires.
alter table accord add column if not exists limite text;
alter table accord add column if not exists explication_generee_le timestamptz;
