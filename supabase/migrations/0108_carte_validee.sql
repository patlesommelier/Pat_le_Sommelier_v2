-- Carte validée par Quid Vinum (« La carte est complète », carte_complete_le) : un restaurant inscrit seul n'a l'impression de
-- la carte des vins et la Gestion de cave qu'après. Les restaurants créés par Quid Vinum le sont d'office.
update restaurant set carte_complete_le = now() where origine <> 'inscription' and carte_complete_le is null;
