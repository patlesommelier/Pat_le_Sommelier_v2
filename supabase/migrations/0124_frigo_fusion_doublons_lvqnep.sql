-- Les vins du frigo ajoutés par 0123 doublaient des vins que LVQNEP avait déjà (avec photo et producteur, souvent dans la base) :
-- « Perarmondo » ↔ « DOCG Barolo Perarmondo », « Rasteau Marnes bleues » ↔ « Rasteau Les Marnes Bleues »…
-- Chaque doublon est fondu dans le vin existant quand un seul vin de LVQNEP contient tous ses mots : le vin existant reçoit le lien
-- WineMS et les prix par restaurant ; les bouteilles du frigo et les commandes passent sur lui ; la ligne de cave créée pour le
-- doublon est retirée (la synchronisation suivante la recrée depuis le vin existant, avec sa photo et son producteur).
do $$
declare
  m record;
  o text;
  n int;
begin
  for m in
    select dv.* from distributeur_vin dv join distributeur d on d.id = dv.distributeur_id
     where lower(d.nom) like '%lvqnep%' and dv.cle like 'frigo|%'
  loop
    select count(*), min(x.id) into n, o from distributeur_vin x
     where x.distributeur_id = m.distributeur_id and x.id <> m.id and x.cle not like 'frigo|%' and x.actif
       and regexp_split_to_array(trim(regexp_replace(lower(m.libelle), '[^[:alnum:]]+', ' ', 'g')), ' ')
           <@ regexp_split_to_array(trim(regexp_replace(lower(x.libelle || ' ' || coalesce(x.appellation, '')), '[^[:alnum:]]+', ' ', 'g')), ' ');
    if n <> 1 then continue; end if;
    update distributeur_vin set winems_vin_id = null where id = m.id;
    update distributeur_vin set winems_vin_id = coalesce(winems_vin_id, m.winems_vin_id) where id = o;
    insert into distributeur_vin_prix_restaurant (distributeur_vin_id, restaurant_id, prix, prix_vente)
      select o, restaurant_id, prix, prix_vente from distributeur_vin_prix_restaurant where distributeur_vin_id = m.id
      on conflict (distributeur_vin_id, restaurant_id) do nothing;
    update frigo_bouteille set distributeur_vin_id = o where distributeur_vin_id = m.id;
    update commande_ligne set distributeur_vin_id = o where distributeur_vin_id = m.id;
    delete from vin_carte where distributeur_vin_id = m.id and frigo;
    delete from distributeur_vin where id = m.id;
  end loop;
end $$;
