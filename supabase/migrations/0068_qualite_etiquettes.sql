-- Qualité de la photo d'un vin de distributeur : « etiquette » (étiquette lisible, à plat ou recadrée), « petite » (vignette trop petite
-- pour lire l'étiquette), « illisible » (photo sans étiquette lisible). Les deux dernières sont à remplacer (recherche sur le web).
alter table distributeur_vin add column if not exists etiquette_qualite text check (etiquette_qualite in ('etiquette', 'petite', 'illisible'));
-- Photos déjà examinées sans que le résultat soit gardé : réexaminées au prochain recadrage (les petites sans appel à Claude).
update distributeur_vin set etiquette_recadree = false
 where etiquette_recadree and etiquette_qualite is null and etiquette_url is not null and etiquette_url not like '%-etiquette-%' and photo_cherche_le is null;
update distributeur_vin set etiquette_qualite = 'etiquette' where etiquette_recadree and etiquette_qualite is null and etiquette_url is not null;
