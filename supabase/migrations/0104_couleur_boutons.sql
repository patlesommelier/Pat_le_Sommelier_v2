-- App des clients d'un restaurant à couleur claire (logo sur fond blanc…) : les boutons et les plats choisis prennent la
-- couleur foncée de son logo (ex. le bleu marine de Bistro Bercuit) plutôt que le noir. Calculée une fois d'après le logo ;
-- couleur_boutons_cle retient la couleur et le logo dont elle vient, pour la recalculer quand ils changent.
alter table restaurant add column if not exists couleur_boutons text;
alter table restaurant add column if not exists couleur_boutons_cle text;
