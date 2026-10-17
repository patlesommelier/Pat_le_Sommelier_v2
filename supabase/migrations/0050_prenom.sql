-- Prénom du restaurateur (demandé à l'inscription) : le tableau de bord de son espace lui dit « Bonjour <prénom> ».
alter table inscription add column if not exists prenom text;
alter table acces_restaurant add column if not exists prenom text;
