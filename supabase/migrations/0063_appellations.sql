-- Gestion des appellations (terroirs) : une appellation regroupée dans une autre garde la trace de celle qui la remplace.
alter table terroir add column if not exists fusionne_dans text references terroir(id) on delete set null;
create index if not exists terroir_statut_idx on terroir (statut);
