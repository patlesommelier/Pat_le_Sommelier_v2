-- Vins de la base « à valider » : ranking 3 par défaut quand leur producteur n'a pas de ranking
-- (sinon ils gardent celui du producteur : le ranking d'un vin remplace celui du producteur dans les accords).
update cuvee c set ranking_pat = 3
  from producteur p
 where p.id = c.producteur_id and c.statut = 'propose' and c.ranking_pat is null and p.ranking_pat is null;

-- Et pour les prochains vins ajoutés « à valider » (tarifs des distributeurs, cartes, ajouts à la main).
create or replace function cuvee_ranking_par_defaut() returns trigger language plpgsql as $$
begin
  if new.statut = 'propose' and new.ranking_pat is null
     and not exists (select 1 from producteur p where p.id = new.producteur_id and p.ranking_pat is not null) then
    new.ranking_pat := 3;
  end if;
  return new;
end $$;
drop trigger if exists cuvee_ranking_par_defaut on cuvee;
create trigger cuvee_ranking_par_defaut before insert on cuvee for each row execute function cuvee_ranking_par_defaut();
