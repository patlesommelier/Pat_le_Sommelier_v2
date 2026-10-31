-- Vins d'un distributeur dont la photo a déjà été cherchée sur le web (sites des producteurs) : pas cherchés deux fois.
alter table distributeur_vin add column if not exists photo_cherche_le timestamptz;
