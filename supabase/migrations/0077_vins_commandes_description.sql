-- Vins ajoutés par une commande : appellation, cépages et région repris du vin de la base de Pat quand il les connaît.
update vin_carte v set appellation_id = coalesce(v.appellation_id, c.appellation_id),
       appellation_texte = coalesce(v.appellation_texte, c.appellation_texte, t.nom),
       cepages = coalesce(nullif(v.cepages, ''), nullif(c.cepages, '')),
       section = coalesce(t.sous_region, t.region, v.section)
  from cuvee c left join terroir t on t.id = c.appellation_id
 where v.id like '%-qv-%' and c.id = v.cuvee_id;
-- Sans cépage connu : le cépage écrit dans le nom du vin (« Riesling », « Alsace 'Pinot Gris' »).
update vin_carte set cepages = m[1]
  from (select id, regexp_match(lower(libelle), '(pinot gris|pinot blanc|pinot noir|riesling|gewurztraminer|sylvaner|muscat|chardonnay|sauvignon|chenin|viognier|gamay|syrah|grenache|merlot|malbec|nebbiolo|sangiovese|barbera|primitivo|vermentino|tempranillo|auxerrois)') as m from vin_carte where id like '%-qv-%') x
 where vin_carte.id = x.id and x.m is not null and (vin_carte.cepages is null or vin_carte.cepages = '');
-- Rubrique du tarif qui regroupe plusieurs régions (« Alsace - Bourgogne - Beaujolais ») : ce n'est pas la région du vin.
update vin_carte set section = null where id like '%-qv-%' and section like '% - %';
