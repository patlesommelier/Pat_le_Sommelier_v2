-- Vins sans alcool (désalcoolisés) : une catégorie de la carte, comme bulles, blancs, rosés, rouges.
alter type couleur_vin add value if not exists 'sans_alcool';
