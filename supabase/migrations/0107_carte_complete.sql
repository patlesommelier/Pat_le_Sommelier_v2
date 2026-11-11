-- « La carte est complète » : le super-admin, carte relue et étiquettes toutes là, l'annonce au restaurant.
-- Avis affichés en post-it (en haut à droite de l'espace du restaurant) ou en bandeau, avec le texte de leur lien.
alter table avis_restaurant add column if not exists forme text not null default 'bandeau' check (forme in ('bandeau', 'post-it'));
alter table avis_restaurant add column if not exists lien_libelle text;
alter table restaurant add column if not exists carte_complete_le timestamptz;
