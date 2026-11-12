-- Fréquence d'inventaire choisie dans les Paramètres du restaurant : un e-mail « Faites votre inventaire de vin » part le lundi
-- matin (chaque semaine, une semaine sur deux, ou le premier lundi du mois). « aucune » : pas de rappel par e-mail.
alter table restaurant add column if not exists inventaire_frequence text not null default 'semaine'
  check (inventaire_frequence in ('aucune', 'semaine', '2semaines', 'mois'));
alter table restaurant add column if not exists inventaire_rappel_le timestamptz;
