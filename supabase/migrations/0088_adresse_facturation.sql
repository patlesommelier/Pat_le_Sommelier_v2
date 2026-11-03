-- Coordonnées du restaurant : adresse de facturation, quand elle diffère de l'adresse de livraison (commande_adresse).
alter table restaurant add column if not exists commande_adresse_facturation text;
