-- Vins d'un distributeur déjà cherchés sur son site : une nouvelle recherche ne les reprend pas (sauf demande), pour ne pas payer deux fois.
alter table distributeur_vin add column if not exists cherche_le timestamptz;
