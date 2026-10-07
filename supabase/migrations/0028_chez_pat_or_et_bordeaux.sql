-- « Chez Pat » aux couleurs de la page d'accueil : bandeau or #E9B949 et logo « chez PAT » bordeaux
-- (logos fournis dans public/accueil/, marges retirées). Un réglage déjà modifié dans « Apparence » n'est pas écrasé.
update restaurant
   set couleur = '#E9B949', couleur_claire = '#FDFAF2',
       logo_url = '/accueil/chez-pat-blanc-logo.png', logo_ratio = 1.878,
       logo_fonce_url = '/accueil/chez-pat-bordeaux-logo.png', logo_fonce_ratio = 1.878, logo_choix = 'fonce'
 where id = 'chez-pat' and modifie_bo is null;
