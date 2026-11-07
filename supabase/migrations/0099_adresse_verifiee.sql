-- Adresse du restaurant vérifiée (Paramètres du restaurant) : choisie dans les propositions d'OpenStreetMap, elle est
-- enregistrée avec sa position (latitude, longitude). Une adresse tapée à la main reste possible, sans position.
alter table restaurant add column if not exists latitude double precision;
alter table restaurant add column if not exists longitude double precision;
alter table restaurant add column if not exists adresse_verifiee_le timestamptz;
