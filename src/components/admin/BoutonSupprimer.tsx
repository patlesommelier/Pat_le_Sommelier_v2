'use client';
// Bouton « Supprimer » placé à côté d'« Enregistrer », dans le formulaire de la fiche : simple bouton (type « button »),
// il n'envoie rien par lui-même. L'action n'est appelée qu'après confirmation, une fois la page prête ; son message
// éventuel ({ ok } ou { erreur }) s'affiche en bas de l'écran.
import { useState, useTransition } from 'react';

type Retour = { ok?: string; erreur?: string } | void | unknown;

export function BoutonSupprimer({ action, libelle, question, className = 'btn sec', enCoursLibelle = 'Suppression…' }: { action: () => unknown; libelle: string; question: string; className?: string; enCoursLibelle?: string }) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok?: string; erreur?: string } | null>(null);
  return (
    <>
      <button type="button" className={className} disabled={enCours} aria-busy={enCours}
        onClick={() => { if (window.confirm(question)) demarrer(async () => {
          const r = (await action()) as Retour;
          if (r && typeof r === 'object' && ('ok' in r || 'erreur' in r)) { setMessage(r as { ok?: string; erreur?: string }); setTimeout(() => setMessage(null), 6000); }
        }); }}>
        {enCours ? enCoursLibelle : libelle}
      </button>
      {message && <span role="status" aria-live="polite" className={`toast-admin ${message.erreur ? 'erreur' : ''}`} onClick={() => setMessage(null)}>{message.erreur ?? message.ok}</span>}
    </>
  );
}
