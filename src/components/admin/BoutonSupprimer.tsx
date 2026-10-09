'use client';
// Bouton « Supprimer » placé à côté d'« Enregistrer », dans le formulaire de la fiche : simple bouton (type « button »),
// il n'envoie rien par lui-même. L'action n'est appelée qu'après confirmation, une fois la page prête.
import { useTransition } from 'react';

export function BoutonSupprimer({ action, libelle, question }: { action: () => void | Promise<void>; libelle: string; question: string }) {
  const [enCours, demarrer] = useTransition();
  return (
    <button type="button" className="btn sec" disabled={enCours} aria-busy={enCours}
      onClick={() => { if (window.confirm(question)) demarrer(async () => { await action(); }); }}>
      {enCours ? 'Suppression…' : libelle}
    </button>
  );
}
