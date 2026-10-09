-- Accords d'un vin ajouté par le restaurant : la tâche d'un plat peut ne noter que certains vins
-- (vides : tous les vins de la carte, comme avant). Les accords des autres vins ne changent pas.
alter table generation_accords add column if not exists vins text[];
