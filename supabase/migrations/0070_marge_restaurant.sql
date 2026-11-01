-- Marge de Quid Vinum par restaurant et par distributeur (sur le prix QV). Une marge par défaut (réglage de Pat, 15 %)
-- est donnée au restaurant quand il active un distributeur. Le prix imposé par vin est abandonné.
alter table fournisseur add column if not exists marge numeric(6,2);
-- Restaurants qui ont déjà un distributeur : ils gardent la marge appliquée jusqu'ici (celle du distributeur).
update fournisseur f set marge = d.marge from distributeur d where f.distributeur_id = d.id and f.marge is null;
insert into reglage_serveur (cle, valeur) values ('qv_marge', '15') on conflict (cle) do nothing;
update distributeur_vin set prix_restaurant = null where prix_restaurant is not null;
