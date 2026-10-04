-- Pat le sommelier — migration 0006 : description détaillée des plats (cuissons, ingrédients, épices, sauce…)
-- Renseignée par le restaurant dans le back-office ; utilisée par Pat pour des accords plus précis. Non montrée aux clients.
alter table plat add column if not exists description_cuisine text;
alter table plat add column if not exists description_modifiee_le timestamptz;
