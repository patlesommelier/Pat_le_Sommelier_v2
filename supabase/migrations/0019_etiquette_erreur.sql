-- Motif du dernier échec d'une demande d'étiquette à Wine Labs (réponse refusée, image illisible…), affiché au super-admin.
alter table vin_carte add column if not exists etiquette_erreur text;
alter table vin_carte add column if not exists etiquette_erreur_le timestamptz;
