-- Logo affiché dans l'app, choisi dans « Apparence » : 'clair' (logo_url) ou 'fonce' (logo_fonce_url).
-- null = automatique : le logo foncé sur une couleur claire, le logo clair sinon (et l'autre s'il manque).
alter table restaurant add column if not exists logo_choix text check (logo_choix in ('clair', 'fonce'));
-- Proportions du logo foncé, comme logo_ratio pour le logo clair.
alter table restaurant add column if not exists logo_fonce_ratio real;
