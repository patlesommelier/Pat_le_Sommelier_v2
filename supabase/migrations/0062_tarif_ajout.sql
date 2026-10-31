-- Tarif lu « en ajout » : ses vins s'ajoutent ou se mettent à jour, aucun vin absent n'est retiré (tarif en plusieurs fichiers).
alter table distributeur_tarif add column if not exists ajout boolean not null default false;
