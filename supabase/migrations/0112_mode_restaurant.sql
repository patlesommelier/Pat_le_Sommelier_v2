-- Statut de l'espace d'un restaurant, choisi par le super-admin (petit bouton de couleur dans la liste des restaurants) :
--   actif       (vert)  : tout est ouvert, les e-mails partent ;
--   inscription (jaune) : Gestion de cave et impression de la carte fermées (carte pas encore validée), les e-mails partent ;
--   test        (rouge) : tout est ouvert, aucun e-mail ne part (relances, rappels, commandes, invitations).
alter table restaurant add column if not exists mode text not null default 'actif'
  check (mode in ('actif', 'inscription', 'test'));
-- Restaurants inscrits seuls dont la carte n'est pas encore validée : en mode inscription (comme avant).
update restaurant set mode = 'inscription' where origine = 'inscription' and carte_complete_le is null and mode = 'actif';
-- Passage au vert (actif) : les e-mails de relance partent le lendemain, puis 3 jours après.
alter table restaurant add column if not exists actif_le timestamptz;
update restaurant set actif_le = coalesce(carte_complete_le, cree_le) where mode = 'actif' and actif_le is null;
