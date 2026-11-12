// Rappel d'inventaire du lundi matin (fréquence choisie dans les Paramètres du restaurant) : quand partir, et quoi dire.
// Sans accès à la base : testé seul.

export type Frequence = 'aucune' | 'semaine' | '2semaines' | 'mois';

/** Date et heure à Bruxelles (jour de la semaine 1 = lundi, jour du mois, heure). */
export function heureBruxelles(maintenant: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', weekday: 'short', day: 'numeric', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(maintenant).map((x) => [x.type, x.value]));
  return { jour: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1, quantieme: Number(p.day), heure: Number(p.hour) };
}

/**
 * Le rappel part-il maintenant ? Le lundi, à partir de 8 h (heure de Bruxelles) ; chaque semaine, une semaine sur deux
 * (au moins 13 jours depuis le dernier rappel) ou le premier lundi du mois ; une seule fois ce lundi-là.
 */
export function rappelDu(frequence: Frequence, maintenant: Date, dernierRappel: Date | null): boolean {
  if (frequence === 'aucune') return false;
  const b = heureBruxelles(maintenant);
  if (b.jour !== 1 || b.heure < 8) return false;
  const depuis = dernierRappel ? (maintenant.getTime() - dernierRappel.getTime()) / 864e5 : Infinity;
  if (depuis < 1) return false; // déjà parti ce lundi
  if (frequence === '2semaines') return depuis >= 13;
  if (frequence === 'mois') return b.quantieme <= 7;
  return true;
}

export function texteRappelInventaire(nom: string, prenom: string | null, lien: string) {
  return {
    sujet: `${nom} : faites votre inventaire de vin`,
    texte: `${prenom ? `Bonjour ${prenom},` : 'Bonjour,'}\n\nC’est le moment de faire l’inventaire de votre cave : comptez vos bouteilles, Pat garde votre stock à jour (alertes de stock bas, commandes au plus juste).\n\nLa page d’inventaire est prête :\n${lien}\n\nBonne semaine,\nPat`,
  };
}
