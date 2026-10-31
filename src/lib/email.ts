import 'server-only';
// Envoi d'e-mails par l'API de Resend : bons de commande aux fournisseurs (avec pièce jointe), invitations et liens
// « mot de passe oublié ». Configuration (variables d'environnement de Coolify) : RESEND_API_KEY, et EMAIL_EXPEDITEUR
// (ou COMMANDES_EXPEDITEUR), l'adresse d'envoi d'un domaine vérifié chez Resend (ex. « Pat le sommelier <bonjour@patlesommelier.com> »).

const expediteur = () => process.env.EMAIL_EXPEDITEUR || process.env.COMMANDES_EXPEDITEUR;
export const envoiEmailConfigure = () => Boolean(process.env.RESEND_API_KEY && expediteur());

/** Pour le super-admin : la clé est-elle présente (jamais sa valeur), et quelle adresse d'envoi est réglée. */
export const etatEmail = () => ({ cle: Boolean(process.env.RESEND_API_KEY?.trim()), expediteur: expediteur()?.trim() || null });

/** Réponse d'erreur de Resend, en clair : la cause la plus fréquente d'abord, puis le message exact de Resend. */
function causeResend(statut: number, corps: string) {
  let message = corps.slice(0, 300);
  try { message = (JSON.parse(corps) as { message?: string }).message ?? message; } catch { /* corps non JSON */ }
  const cause = statut === 401 || /api key/i.test(message) ? 'la clé RESEND_API_KEY est refusée (mal copiée, ou supprimée chez Resend)'
    : /not verified|verify/i.test(message) ? 'le domaine de l’adresse d’envoi n’est pas encore « Verified » chez Resend'
    : /from/i.test(message) && statut === 422 ? 'l’adresse d’envoi EMAIL_EXPEDITEUR est mal écrite (forme attendue : Pat le sommelier <bonjour@quidvinum.com>)'
    : statut === 403 ? 'Resend refuse cet envoi (domaine non vérifié, ou compte en mode test qui n’envoie qu’à sa propre adresse)'
    : statut === 429 ? 'trop d’e-mails envoyés d’un coup, réessayez dans une minute' : null;
  return `${cause ? `${cause}. ` : ''}Resend a répondu ${statut} : « ${message} »`;
}

export interface Email {
  a: string; copie?: string | null; repondreA?: string | null; sujet: string; texte: string;
  pieceJointe?: { nom: string; octets: Uint8Array };
}

/** Envoie l'e-mail ; renvoie un message d'erreur lisible, ou null si c'est parti. */
export async function envoyerEmail(e: Email): Promise<string | null> {
  if (!envoiEmailConfigure()) return 'L’envoi d’e-mails n’est pas encore activé sur Pat.';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: expediteur(), to: [e.a], cc: e.copie ? [e.copie] : undefined, reply_to: e.repondreA ?? undefined,
        subject: e.sujet, text: e.texte,
        attachments: e.pieceJointe ? [{ filename: e.pieceJointe.nom, content: Buffer.from(e.pieceJointe.octets).toString('base64') }] : undefined,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) return null;
    const corps = await r.text();
    console.error('[email] refusé', r.status, corps.slice(0, 300));
    return `L’e-mail n’a pas pu partir : ${causeResend(r.status, corps)}.`;
  } catch (err) {
    console.error('[email] échec', (err as Error).message);
    return `L’e-mail n’a pas pu partir : Resend est injoignable (${(err as Error).message}).`;
  }
}
