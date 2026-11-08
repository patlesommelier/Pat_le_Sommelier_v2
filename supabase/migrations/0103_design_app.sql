-- Nouveau design de l'app des clients (« Crème et courbes ») : activé restaurant par restaurant pour le valider
-- (d'abord Lola). Vide : le design actuel.
alter table restaurant add column if not exists design_app text;
update restaurant set design_app = 'creme' where id = 'lola' and design_app is null;
