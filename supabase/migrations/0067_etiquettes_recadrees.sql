-- Photos des vins d'un distributeur recadrées sur l'étiquette (une photo de bouteille devient l'étiquette) : pas recadrées deux fois.
alter table distributeur_vin add column if not exists etiquette_recadree boolean not null default false;
