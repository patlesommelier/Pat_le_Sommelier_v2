-- Photo d'un plat, déposée par le restaurant dans son espace : montrée aux clients avec les propositions de Pat.
alter table plat add column if not exists photo_url text;
