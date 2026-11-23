-- Frigo connecté : son cycle de vie dans WineMS (0 en service, 1 au dépôt, 2 en maintenance), montré dans Ma cave.
alter table frigo add column if not exists cycle int;
