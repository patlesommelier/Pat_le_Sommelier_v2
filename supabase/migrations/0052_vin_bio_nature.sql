-- Bio et nature choisis par le restaurant pour un vin de sa carte (comme le coup de cœur).
-- null : celui de la base de Pat (cuvée) ; true / false : le choix du restaurant, prioritaire.
alter table vin_carte add column if not exists bio boolean;
alter table vin_carte add column if not exists nature boolean;
