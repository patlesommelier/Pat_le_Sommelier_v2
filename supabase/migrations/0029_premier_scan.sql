-- Première ouverture de l'app des clients d'un restaurant (son QR code scanné) : la page d'inscription,
-- qui affiche le QR code une fois les accords prêts, bascule alors vers l'espace du restaurant.
alter table restaurant add column if not exists premier_scan_le timestamptz;
