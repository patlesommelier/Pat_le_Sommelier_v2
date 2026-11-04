-- Pastille du menu du restaurant : nouveautés d'une commande Quid Vinum pas encore vues (statut changé par le super-admin,
-- facture jointe) — plus récentes que statut_qv_vu_le. Tout ce qui existe déjà est considéré comme vu.
alter table commande add column if not exists statut_qv_vu_le timestamptz;
update commande set statut_qv_vu_le = now() where statut_qv_vu_le is null;
