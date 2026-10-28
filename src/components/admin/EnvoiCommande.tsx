'use client';
// « Envoyer au fournisseur » : le bon de commande (PDF) part depuis la page.
// - Envoi par Pat configuré (serveur) : l'e-mail part avec le PDF en pièce jointe.
// - Sinon : le PDF est partagé vers la messagerie de l'appareil (pièce jointe, sur téléphone, tablette et Mac) ;
//   à défaut, il est téléchargé et la messagerie s'ouvre avec la commande rédigée. La commande passe alors « envoyée ».
import { useState, useTransition } from 'react';

type Retour = { ok?: string; erreur?: string } | void;

export function EnvoiCommande({ pdf, fichier, email, sujet, corps, serveur, envoyer, marquer, deja }: {
  pdf: string; fichier: string; email: string; sujet: string; corps: string; serveur: boolean;
  envoyer: () => Promise<Retour>; marquer: () => Promise<Retour>; deja: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok?: string; erreur?: string } | null>(null);

  const cliquer = () => demarrer(async () => {
    setMessage(null);
    if (serveur) { setMessage((await envoyer()) ?? null); return; }
    const blob = await (await fetch(pdf)).blob();
    const piece = new File([blob], fichier, { type: 'application/pdf' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [piece] })) {
      try {
        await navigator.share({ files: [piece], title: sujet, text: corps });
        setMessage((await marquer()) ?? null);
      } catch { /* partage annulé */ }
      return;
    }
    // Ordinateur sans partage : le PDF est téléchargé, la messagerie s'ouvre avec la commande ; il reste à joindre le PDF.
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fichier; a.click();
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    setMessage({ ok: `Le PDF « ${fichier} » est téléchargé : joignez-le à l’e-mail ouvert dans votre messagerie.` });
    await marquer();
  });

  return (
    <span className="pile" style={{ gap: 6 }}>
      <button type="button" className="btn rouge" onClick={cliquer} disabled={enCours} aria-busy={enCours}>
        {enCours ? 'Envoi…' : deja ? 'Renvoyer au fournisseur' : 'Envoyer au fournisseur'}
      </button>
      {message?.ok && <span className="petit" style={{ color: 'var(--encre)' }}>{message.ok}</span>}
      {message?.erreur && <span className="petit" style={{ color: 'var(--ocre)' }}>{message.erreur}</span>}
    </span>
  );
}
