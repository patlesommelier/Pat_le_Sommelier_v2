-- Vins de la base : appellation saisie par le super-admin, gardée telle quelle même quand elle ne correspond
-- à aucune appellation de la base (elle est alors seulement non reliée).
alter table cuvee add column if not exists appellation_texte text;
