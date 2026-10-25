-- Couleur des supports imprimés (carte des vins, menu, pense-bête), choisie dans « Apparence ».
-- null : automatique (la couleur de l'app si elle se lit sur le blanc, sinon celle du logo).
alter table restaurant add column if not exists couleur_impression text;
