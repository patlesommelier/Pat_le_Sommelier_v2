-- Numéro de commande interne du restaurant (facultatif), saisi dans le panier : repris sur le bon de commande et l'e-mail.
alter table commande add column if not exists reference_interne text;
