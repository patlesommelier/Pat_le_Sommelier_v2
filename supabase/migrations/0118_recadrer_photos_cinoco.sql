-- Photos de Cinoco gardées entières (bouteille complète, trop petite pour être recadrée à l'époque) : à recadrer sur
-- l'étiquette avec le bouton « Recadrer sur l'étiquette » (celles déjà recadrées restent telles quelles : « déjà l'étiquette »).
update distributeur_vin set etiquette_recadree = false
 where image_source like '%cinocobcsa.blob.core.windows.net%' and etiquette_url is not null and etiquette_recadree;
