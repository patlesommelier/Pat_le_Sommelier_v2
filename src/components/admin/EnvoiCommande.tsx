'use client';
// « Envoyer au fournisseur » : le bon de commande (PDF) part depuis la page.
// - Envoi par Pat configuré (serveur) : l'e-mail part avec le PDF en pièce jointe.
// - Sinon : la messagerie s'ouvre avec la commande rédigée, à l'adresse du fournisseur, et le PDF est téléchargé
//   pour être joint. Tout se fait dans le clic (sans attente), sinon le navigateur bloque l'ouverture de la messagerie.
// La commande passe alors « envoyée ».
import { useState, useTransition } from 'react';

type Retour = { ok?: string; erreur?: string } | void;

export function EnvoiCommande({ pdf, fichier, email, sujet, corps, serveur, envoyer, marquer, deja }: {
  pdf: string; fichier: string; email: string; sujet: string; corps: string; serveur: boolean;
  envoyer: () => Promise<Retour>; marquer: () => Promise<Retour>; deja: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok?: string; erreur?: string } | null>(null);

  const cliquer = () => {
    setMessage(null);
    if (serveur) { demarrer(async () => setMessage((await envoyer()) ?? null)); return; }
    const a = document.createElement('a');
    a.href = pdf; a.download = fichier;
    document.body.appendChild(a); a.click(); a.remove();
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    setMessage({ ok: `Votre messagerie s’ouvre : joignez-y le PDF « ${fichier} », qui vient d’être téléchargé.` });
    demarrer(async () => { await marquer(); });
  };

  return (
    <span className="pile" style={{ gap: 6 }}>
      <button type="button" className="btn rouge" onClick={cliquer} disabled={enCours} aria-busy={enCours}>
        {enCours && serveur ? 'Envoi…' : deja ? 'Renvoyer au fournisseur' : 'Envoyer au fournisseur'}
      </button>
      {message?.ok && <span className="petit" style={{ color: 'var(--encre)', maxWidth: 320 }}>{message.ok}</span>}
      {message?.erreur && <span className="petit" style={{ color: 'var(--ocre)', maxWidth: 320 }}>{message.erreur}</span>}
    </span>
  );
}
