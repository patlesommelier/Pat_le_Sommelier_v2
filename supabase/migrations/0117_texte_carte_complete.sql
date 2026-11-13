-- Nouveau texte du post-it vert « La carte est complète » : aussi pour ceux déjà envoyés et pas encore fermés.
update avis_restaurant
   set titre = 'Votre carte des vins est complète',
       texte = 'Quid Vinum a relu votre carte des vins et chaque vin a maintenant sa photo d’étiquette et sa présentation. La carte est prête pour l’impression. Vous avez aussi accès à la cave, qui vous permet d’enregistrer votre stock de vin et de passer des commandes.'
 where titre = 'La carte est complète' and lu_le is null;
