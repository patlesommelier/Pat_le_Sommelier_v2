-- Vins des catalogues commandés alors qu'ils n'étaient pas dans les vins du restaurant (commandes ouvertes) :
-- ajoutés à ses vins (stock = bouteilles déjà reçues, le reste « en commande »), pas encore affichés sur la carte.
with a_ajouter as (
  select l.commande_id, l.ordre, c.restaurant_id, d.id as dv, d.libelle, d.section, d.millesime, d.producteur_id, d.cuvee_id,
         coalesce(p.nom, d.producteur_texte) as producteur, l.quantite - l.recue as en_commande, l.recue as stock, l.prix_achat,
         coalesce(c.fournisseur_id, (select f.id from fournisseur f where f.restaurant_id = c.restaurant_id and f.distributeur_id = d.distributeur_id limit 1)) as fournisseur_id,
         coalesce(nullif(d.contenance, ''), '75 cl') as format,
         case when d.couleur in ('bulles', 'blanc', 'rose', 'orange', 'rouge', 'doux') then d.couleur
              when k.couleur is not null then k.couleur::text
              when translate(lower(d.libelle), 'éèêàâîïôöüû', 'eeeaaiioouu') ~ '(champagne|cremant|prosecco|cava|brut|petillant|spumante|franciacorta)' then 'bulles'
              when translate(lower(d.libelle), 'éèêàâîïôöüû', 'eeeaaiioouu') ~ '\m(rose|rosato|rosado)\M' then 'rose'
              when translate(lower(d.libelle), 'éèêàâîïôöüû', 'eeeaaiioouu') ~ '(blanc|bianco|blanco|weiss|riesling|chardonnay|sauvignon|chenin|viognier|gewurztraminer|pinot gris|pinot blanc|sylvaner|muscat|gruner|albarino|vermentino|grillo|fiano|greco|chablis|sancerre|semillon|marsanne|roussanne|aligote|muscadet|savagnin|furmint|assyrtiko|godello|verdejo)' then 'blanc'
              else 'rouge' end as couleur,
         'qv-' || substr(md5(l.commande_id || '-' || l.ordre), 1, 10) as suffixe
    from commande_ligne l join commande c on c.id = l.commande_id join distributeur_vin d on d.id = l.distributeur_vin_id
    left join producteur p on p.id = d.producteur_id left join cuvee k on k.id = d.cuvee_id
   where l.vin_id is null and c.statut = 'ouverte'
)
insert into vin_carte (id, restaurant_id, couleur, section, libelle, producteur_texte, producteur_id, cuvee_id, millesime, format, ordre, disponible,
                         stock, en_commande, fournisseur_id, distributeur_vin_id, prix_achat, modifie_bo)
  select restaurant_id || '-' || suffixe, restaurant_id, couleur::couleur_vin, section, libelle, producteur, producteur_id, cuvee_id, millesime, format,
         1000 + row_number() over (), false, stock, en_commande, fournisseur_id, dv, prix_achat, now()
    from a_ajouter on conflict (id) do nothing;
-- (requête séparée : une insertion dans un « with » n'est pas visible du reste de la même requête)
update commande_ligne l set vin_id = c.restaurant_id || '-qv-' || substr(md5(l.commande_id || '-' || l.ordre), 1, 10)
  from commande c
 where c.id = l.commande_id and l.vin_id is null and c.statut = 'ouverte' and l.distributeur_vin_id is not null
   and exists (select 1 from vin_carte v where v.id = c.restaurant_id || '-qv-' || substr(md5(l.commande_id || '-' || l.ordre), 1, 10));
