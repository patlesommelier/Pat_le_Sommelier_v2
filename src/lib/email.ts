import 'server-only';
// Envoi d'e-mails par l'API de Resend : bons de commande aux fournisseurs (avec pièce jointe), invitations et liens
// « mot de passe oublié ». Configuration (variables d'environnement de Coolify) : RESEND_API_KEY, et EMAIL_EXPEDITEUR
// (ou COMMANDES_EXPEDITEUR), l'adresse d'envoi d'un domaine vérifié chez Resend (ex. « Pat le sommelier <bonjour@patlesommelier.com> »).

const expediteur = () => process.env.EMAIL_EXPEDITEUR || process.env.COMMANDES_EXPEDITEUR;
export const envoiEmailConfigure = () => Boolean(process.env.RESEND_API_KEY && expediteur());

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
    console.error('[email] refusé', r.status, (await r.text()).slice(0, 300));
    return 'L’e-mail n’a pas pu partir (refusé par le service d’envoi).';
  } catch (err) {
    console.error('[email] échec', (err as Error).message);
    return 'L’e-mail n’a pas pu partir (service d’envoi injoignable).';
  }
}
