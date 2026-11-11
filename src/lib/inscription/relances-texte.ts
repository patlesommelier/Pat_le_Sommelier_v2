// Texte des e-mails de relance de la mise en route (sans accès à la base : testé seul).

export interface Relance { id: string; nom: string; statut: string; email: string; prenom: string | null; sans_prix: number }

/** Texte de la relance, selon où en est le restaurant (accords encore en préparation, ou app prête sans client). */
export function texteRelance(r: Relance, numero: 1 | 2, lien: string) {
  const bonjour = r.prenom ? `Bonjour ${r.prenom},` : 'Bonjour,';
  const sujet = numero === 1 ? `${r.nom} : votre app est presque prête` : `${r.nom} : vos clients n’attendent plus que le QR code`;
  const etat = r.statut === 'mise_en_place'
    ? 'Je termine encore quelques accords mets-vins pour votre carte : votre app s’ouvrira à vos clients dès qu’ils seront prêts.'
    : 'Vos accords mets-vins sont prêts : votre app attend ses premiers clients.';
  const pas = [
    'Essayez-la comme un client : choisissez un de vos plats et voyez le vin que je propose, et pourquoi.',
    r.sans_prix ? `Vérifiez ${r.sans_prix > 1 ? `les ${r.sans_prix} vins et plats` : 'le vin ou le plat'} pour lesquels je n’ai pas trouvé de prix.` : null,
    'Imprimez un chevalet avec votre QR code et posez-le sur vos tables.',
  ].filter(Boolean).map((t, i) => `${i + 1}. ${t}`).join('\n');
  const texte = numero === 1
    ? `${bonjour}\n\n${etat}\n\nPour être prêt ce soir, il ne reste que quelques minutes :\n${pas}\n\nTout se trouve sur votre tableau de bord :\n${lien}\n\nÀ bientôt à table,\nPat`
    : `${bonjour}\n\nVotre carte des vins et votre menu sont prêts chez Pat, mais aucun client ne l’a encore utilisé.\nLe plus simple : imprimez un chevalet de table avec votre QR code, depuis votre tableau de bord.\n\n${lien}\n\nSi quelque chose vous bloque, répondez simplement à cet e-mail.\n\nPat`;
  return { sujet, texte };
}
