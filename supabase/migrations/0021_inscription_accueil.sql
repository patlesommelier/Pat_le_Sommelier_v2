-- Inscription depuis la page d'accueil (ordinateur, accès immédiat) : la carte et le menu sont lus en arrière-plan.
-- lecture = { carte: { statut: en_attente | en_cours | ok | erreur, nombre, message, lanceeLe }, menu: {…} }
-- (seulement des compteurs : c'est tout ce que le navigateur reçoit).
alter table inscription add column if not exists lecture jsonb not null default '{}';
