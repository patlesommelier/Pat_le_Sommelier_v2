-- Contenances d'un vin (cases de la fiche du back-office) : bouteille, demi, quart, verre, magnum.
-- Reprises de la carte lue : contenance de chaque ligne du même vin (même couleur, intitulé et millésime)
-- et prix au verre ; sans information, une bouteille.
alter table vin_carte add column if not exists contenances text[] not null default '{bouteille}';

with lignes as (
  select id, restaurant_id, couleur, lower(libelle) as k, coalesce(millesime, '') as m, prix_verre,
         case when format ~* 'verre' then 'verre'
              when cl is null or cl = 0 then 'bouteille'
              when cl >= 140 then 'magnum' when cl >= 70 then 'bouteille' when cl >= 35 then 'demi' else 'quart' end as c
    from (select v.*, nullif(regexp_replace(replace(lower(v.format), ',', '.'), '[^0-9.]', '', 'g'), '')::numeric as cl from vin_carte v) x
), codes as (
  select restaurant_id, couleur, k, m, c from lignes
  union select restaurant_id, couleur, k, m, 'verre' from lignes where prix_verre is not null
), vins as (
  select restaurant_id, couleur, k, m,
         array_agg(c order by array_position(array['bouteille', 'demi', 'quart', 'verre', 'magnum'], c)) as contenances
    from codes group by 1, 2, 3, 4
)
update vin_carte v set contenances = vins.contenances
  from vins
 where vins.restaurant_id = v.restaurant_id and vins.couleur = v.couleur and vins.k = lower(v.libelle) and vins.m = coalesce(v.millesime, '');
