// Relances de la mise en route (e-mails le lendemain puis 3 jours après l'inscription) et rappels d'inventaire du lundi :
// vérifiés toutes les heures.
import { envoyerRelances } from './lib/inscription/relances';
import { envoyerRappelsInventaire } from './lib/inscription/rappel-inventaire';

const passer = () => {
  envoyerRelances()
    .then((n) => { if (n) console.log(`[relances] ${n} e-mail(s) de relance envoyé(s)`); })
    .catch((e) => console.error('[relances]', e));
  // Rappels d'inventaire du lundi matin (fréquence choisie dans les Paramètres du restaurant).
  envoyerRappelsInventaire()
    .then((n) => { if (n) console.log(`[inventaire] ${n} rappel(s) d'inventaire envoyé(s)`); })
    .catch((e) => console.error('[inventaire]', e));
};
setTimeout(passer, 5 * 60 * 1000); // après le démarrage (migrations faites, serveur prêt)
setInterval(passer, 60 * 60 * 1000);
