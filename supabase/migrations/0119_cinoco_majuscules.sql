-- Catalogue Cinoco : les mots écrits tout en majuscules passent en minuscules avec une capitale (« MARANGES » → « Maranges »,
-- « CHATEAU DE LA TOUR » → « Chateau de la Tour », « D'ARMAILHAC » → « d'Armailhac » après un autre mot). Les sigles restent
-- (AOC, IGP, DOC, XO…). Concerne les lignes du tarif de Cinoco, et les fiches de la base reliées (producteur, vin, appellation).
create or replace function casse_titre_tmp(t text) returns text language plpgsql as $$
declare
  r text := '';
  m text[];
  mot text;
  premier boolean := true;
  avant text := '';
begin
  if t is null then return null; end if;
  for m in select regexp_matches(t, '([[:alpha:]]+|[^[:alpha:]]+)', 'g') loop
    mot := m[1];
    if mot ~ '^[[:alpha:]]+$' and length(mot) >= 2 and mot = upper(mot) and mot <> lower(mot)
       and mot not in ('AOC', 'AOP', 'IGP', 'DOC', 'DOCG', 'IGT', 'VDP', 'VDT', 'DO', 'DOP', 'BIO', 'XO', 'VS', 'VSOP', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII', 'GSM', 'USA', 'UK', 'MV', 'NV', 'NM', 'LBV', 'VT', 'SGN') then
      if avant ~ '[0-9]$' then
        mot := lower(mot); -- « 1ER CRU » → « 1er Cru »
      elsif not premier and lower(mot) in ('de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'sur', 'sous', 'aux', 'au', 'di', 'del', 'della', 'dei', 'y', 'von', 'van', 'der', 'den', 'da', 'do', 'dos', 'das') then
        mot := lower(mot);
      else
        mot := upper(left(mot, 1)) || lower(substr(mot, 2));
      end if;
    end if;
    if mot ~ '[[:alpha:]]' then premier := false; end if;
    r := r || mot;
    avant := mot;
  end loop;
  -- « D' » et « L' » au milieu d'un nom : en minuscule (« Château d'Armailhac »).
  r := regexp_replace(r, '([[:space:]-])D([''’])', '\1d\2', 'g');
  r := regexp_replace(r, '([[:space:]-])L([''’])', '\1l\2', 'g');
  return r;
end $$;

-- Un mot d'au moins trois lettres tout en majuscules (sinon rien à changer).
create or replace function a_majuscules_tmp(t text) returns boolean language sql immutable as $$
  select t is not null and t ~ '[[:upper:]]{3,}' and t <> casse_titre_tmp(t)
$$;

with cinoco as (select id from distributeur where lower(nom) like '%cinoco%')
update distributeur_vin set libelle = casse_titre_tmp(libelle)
 where distributeur_id in (select id from cinoco) and a_majuscules_tmp(libelle);

with cinoco as (select id from distributeur where lower(nom) like '%cinoco%')
update distributeur_vin set producteur_texte = casse_titre_tmp(producteur_texte)
 where distributeur_id in (select id from cinoco) and a_majuscules_tmp(producteur_texte);

with cinoco as (select id from distributeur where lower(nom) like '%cinoco%'),
     cuvees as (select distinct cuvee_id as id from distributeur_vin where distributeur_id in (select id from cinoco) and cuvee_id is not null)
update cuvee set nom = casse_titre_tmp(nom) where id in (select id from cuvees) and a_majuscules_tmp(nom);

with cinoco as (select id from distributeur where lower(nom) like '%cinoco%'),
     cuvees as (select distinct cuvee_id as id from distributeur_vin where distributeur_id in (select id from cinoco) and cuvee_id is not null)
update cuvee set appellation_texte = casse_titre_tmp(appellation_texte) where id in (select id from cuvees) and a_majuscules_tmp(appellation_texte);

with cinoco as (select id from distributeur where lower(nom) like '%cinoco%'),
     producteurs as (select distinct producteur_id as id from distributeur_vin where distributeur_id in (select id from cinoco) and producteur_id is not null)
update producteur set nom = casse_titre_tmp(nom) where id in (select id from producteurs) and a_majuscules_tmp(nom);

with cinoco as (select id from distributeur where lower(nom) like '%cinoco%'),
     appellations as (select distinct c.appellation_id as id from cuvee c join distributeur_vin v on v.cuvee_id = c.id
                       where v.distributeur_id in (select id from cinoco) and c.appellation_id is not null)
update terroir set nom = casse_titre_tmp(nom) where id in (select id from appellations) and a_majuscules_tmp(nom);

drop function a_majuscules_tmp(text);
drop function casse_titre_tmp(text);
