-- Verrou de finalisation : la confirmation peut être détectée en même temps par le lien de l'e-mail,
-- l'écran d'attente (autre appareil) et la connexion. Un seul appel crée le restaurant.
alter table inscription add column if not exists finalisation_le timestamptz;

-- Plusieurs appareils : le navigateur qui ouvre le lien de confirmation reçoit son propre jeton,
-- sans couper celui de l'appareil où l'inscription a été faite (qui attend la confirmation).
alter table inscription add column if not exists jetons_autres text[] not null default '{}';
