-- Message d'accueil par défaut de l'app : « Bienvenue chez …, je vous aide à choisir le vin » (Pat parle en « je »).
-- Les restaurants qui avaient gardé l'ancien texte par défaut le reçoivent ; un texte personnalisé ne change pas.
update restaurant set accroche = replace(accroche, '|nous vous aidons à choisir votre vin', '|je vous aide à choisir le vin')
 where accroche like '%|nous vous aidons à choisir votre vin';
