-- « Renvoyer le menu » : le restaurant renvoie son menu complet (photo ou PDF), lu dans la même file que les suggestions.
alter table lecture_suggestions add column if not exists menu boolean not null default false;
