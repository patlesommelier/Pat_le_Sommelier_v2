-- Gestion des stocks : prix d'achat HTVA d'une bouteille chez le fournisseur (sur la ligne principale du vin),
-- et repris sur chaque ligne de commande au moment de la commande.
alter table vin_carte add column if not exists prix_achat numeric(10, 2);
alter table commande_ligne add column if not exists prix_achat numeric(10, 2);
