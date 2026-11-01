-- Petit texte de présentation d'un distributeur, montré aux restaurants (page Distributeurs), avec le lien vers son site.
alter table distributeur add column if not exists presentation text;
