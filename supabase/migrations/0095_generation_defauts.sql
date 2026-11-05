-- Défauts relevés au premier passage de chaque plat (vins oubliés, mots interdits, longueur…), pour comprendre le coût
-- des corrections : additionnés par restaurant dans la page Consommation Claude du super-admin.
alter table generation_accords add column if not exists defauts jsonb;
