-- Note d'un vin dans la base de Pat (facultative) : elle remplace celle du producteur pour ce vin (second vin plus bas que le grand vin).
-- Les restaurants prennent désormais automatiquement les notes de la base : celle du vin, sinon celle du producteur.
alter table cuvee add column if not exists ranking_pat smallint check (ranking_pat between 0 and 5);
