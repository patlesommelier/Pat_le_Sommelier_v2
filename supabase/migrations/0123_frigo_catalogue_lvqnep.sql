-- Frigo connecté : les vins du frigo sont des vins comme les autres, au catalogue du distributeur LVQNEP.
--   * chaque ligne LVQNEP peut être liée au vin WineMS correspondant (winems_vin_id) : c'est ce lien qui rattache les
--     bouteilles du frigo à la base de Quid Vinum (photo, fiche, prix) ;
--   * prix propre à un restaurant (prix d'achat convenu, et prix de vente de départ sur sa carte), avant le calcul habituel ;
--   * une ligne de la cave d'un restaurant peut venir du frigo (stock suivi tout seul, verrouillé à l'inventaire).
alter table distributeur_vin add column if not exists winems_vin_id text;
create unique index if not exists distributeur_vin_winems_idx on distributeur_vin (distributeur_id, winems_vin_id) where winems_vin_id is not null;

create table if not exists distributeur_vin_prix_restaurant (
  distributeur_vin_id text not null references distributeur_vin(id) on delete cascade,
  restaurant_id       text not null references restaurant(id) on delete cascade,
  prix                numeric(10,2),   -- prix d'achat HTVA convenu avec ce restaurant
  prix_vente          numeric(10,2),   -- prix de vente de départ sur sa carte (TVAC)
  primary key (distributeur_vin_id, restaurant_id)
);

alter table vin_carte add column if not exists frigo boolean not null default false;
alter table frigo_bouteille add column if not exists distributeur_vin_id text references distributeur_vin(id) on delete set null;

-- Les 10 vins du frigo du Bistro Bercuit au catalogue LVQNEP (s'il existe), avec leurs prix pour les restaurants reliés à WineMS.
do $$
declare
  d text;
begin
  select id into d from distributeur where lower(nom) like '%lvqnep%' order by cree_le limit 1;
  if d is null then return; end if;
  create temp table vins_frigo (nom text, appellation text, millesime text, achat numeric, vente numeric, ordre int) on commit drop;
  insert into vins_frigo values
    ('Blauer Spätburgunder', 'Qualitätswein', '2023', 14.90, 38.50, 1),
    ('Castello di Brolio', 'Chianti Gran Selezione', '2021', 49.10, 115.00, 2),
    ('Cuvée du Clos', 'Châteauneuf-du-Pape', '2022', 31.75, 76.90, 3),
    ('Langhe Nebbiolo', 'Langhe Nebbiolo', '2023', 24.95, 59.00, 4),
    ('L''Apéro', 'Côtes du Roussillon Villages', '2018', 15.20, 36.78, 5),
    ('La Roque', 'Cahors', '2023', 17.46, 42.26, 6),
    ('Molino a Vento - Nero d''Avola bio', 'Nero d''Avola', '2023', 14.00, 34.00, 7),
    ('Nerello Mascalese', 'Etna Rosso', '2021', 39.80, 95.00, 8),
    ('Perarmondo', 'Barolo', null, 51.20, 119.00, 9),
    ('Rasteau Marnes bleues', 'Rasteau', '2022', 20.00, 48.40, 10);
  insert into distributeur_vin (id, distributeur_id, cle, libelle, appellation, millesime, couleur, ordre)
  select gen_random_uuid()::text, d, 'frigo|' || lower(v.nom) || '|' || coalesce(v.millesime, ''), v.nom, v.appellation, v.millesime, 'rouge',
         coalesce((select max(ordre) from distributeur_vin where distributeur_id = d), 0) + v.ordre
    from vins_frigo v
   on conflict (distributeur_id, cle) do nothing;
  insert into distributeur_vin_prix_restaurant (distributeur_vin_id, restaurant_id, prix, prix_vente)
  select dv.id, r.id, v.achat, v.vente
    from vins_frigo v
    join distributeur_vin dv on dv.distributeur_id = d and dv.cle = 'frigo|' || lower(v.nom) || '|' || coalesce(v.millesime, '')
    cross join restaurant r
   where r.winems_client_id is not null or lower(r.nom) like '%bercuit%'
  on conflict (distributeur_vin_id, restaurant_id) do nothing;
end $$;
