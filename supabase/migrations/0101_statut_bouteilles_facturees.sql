-- Statuts des commandes Quid Vinum : « Bouteilles livrées » et « Commande livrée » faisaient doublon. Il ne reste que
-- « Commande livrée » (statut livree), puis un nouveau statut « Bouteilles facturées » (facturee). Les commandes qui étaient
-- « Commande livrée » (ancien sens de facturee) passent sur livree.
update commande set statut_qv = 'livree' where statut_qv = 'facturee';
