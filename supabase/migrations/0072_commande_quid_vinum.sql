-- Commande Quid Vinum : une seule commande pour plusieurs distributeurs de Quid Vinum (chaque ligne garde son distributeur),
-- envoyée à Quid Vinum. Sans fournisseur unique (fournisseur_id vide).
alter table commande add column if not exists quid_vinum boolean not null default false;
