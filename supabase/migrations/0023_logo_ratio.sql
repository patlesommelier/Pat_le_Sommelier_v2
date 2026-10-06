-- Proportions du logo (largeur / hauteur, marges vides retirées) : un logo carré ou rond est affiché plus grand
-- dans le bandeau de l'app qu'un logo en largeur. null = pas encore mesuré ; 0 = mesure impossible.
alter table restaurant add column if not exists logo_ratio real;
