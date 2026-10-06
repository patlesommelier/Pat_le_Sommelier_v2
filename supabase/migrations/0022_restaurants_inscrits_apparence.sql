-- Restaurants inscrits par le formulaire, encore sans apparence personnalisée : même accroche que Lola
-- (« Bienvenue chez X, » puis « nous vous aidons à choisir votre vin ») et fond clair presque blanc.
update restaurant set accroche = 'Bienvenue chez ' || nom || ',|nous vous aidons à choisir votre vin'
 where origine = 'inscription' and accroche = 'Bienvenue chez ' || nom || ' !';
update restaurant set couleur_claire = '#F6F0F2'
 where origine = 'inscription' and couleur = '#610420' and couleur_claire = '#ECE1E4' and modifie_bo is null;
