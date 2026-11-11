// Relances de la mise en route (e-mails le lendemain puis 3 jours après l'inscription) : vérifiées toutes les heures.
import { envoyerRelances } from './lib/inscription/relances';

const passer = () => envoyerRelances()
  .then((n) => { if (n) console.log(`[relances] ${n} e-mail(s) de relance envoyé(s)`); })
  .catch((e) => console.error('[relances]', e));
setTimeout(passer, 5 * 60 * 1000); // après le démarrage (migrations faites, serveur prêt)
setInterval(passer, 60 * 60 * 1000);
