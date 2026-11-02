-- Producteur regroupé dans un autre (doublon) : retiré de la base, son nom mène au producteur gardé (tarifs, cartes).
alter table producteur add column if not exists fusionne_dans text references producteur(id) on delete set null;
