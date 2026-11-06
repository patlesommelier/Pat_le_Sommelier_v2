-- Prix des vins des distributeurs pour un restaurant : le prix public du distributeur moins la remise du restaurant
-- chez ce distributeur (ex. 8 % chez Licata), comme s'il commandait en direct. Le prix QV n'entre plus dans ce calcul :
-- Quid Vinum est rémunéré par la commission du distributeur (prix restaurant − prix QV), jamais montrée au restaurant.
-- La marge ajoutée au prix QV (fournisseur.marge, reglage qv_marge) n'est plus utilisée ; les colonnes restent pour mémoire.

-- Remise par défaut des restaurants chez ce distributeur (%), sur son prix public.
alter table distributeur add column if not exists remise_restaurant numeric(6,2) not null default 0
  check (remise_restaurant >= 0 and remise_restaurant < 100);
-- Remise propre à un restaurant (%) ; vide : celle du distributeur.
alter table fournisseur add column if not exists remise numeric(6,2) check (remise >= 0 and remise < 100);

-- Prix public : lu sur le tarif, sinon recalculé depuis le prix QV et la remise QV (prix QV ÷ (1 − remise QV)).
-- Sans prix public ni remise QV : pas de prix (le vin n'est pas proposé au restaurant à un prix inventé).
create or replace function prix_restaurant_distributeur(publie numeric, qv numeric, remise_qv numeric, remise numeric)
returns numeric language sql immutable as $$
  select round(coalesce(publie, case when remise_qv > 0 and remise_qv < 100 then round(qv / (1 - remise_qv / 100), 2) end)
               * (1 - coalesce(remise, 0) / 100), 2)
$$;
