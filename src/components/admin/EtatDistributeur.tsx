'use client';
// Distributeur Quid Vinum (page Distributeurs du restaurant) : un interrupteur à droite de son nom, vert (✓, actif) ou rouge (✕, non sélectionné).
// Le désactiver demande confirmation (ses vins n'auront plus de distributeur).
import { useState, useTransition } from 'react';

type Retour = { ok?: string; erreur?: string } | void;

export function EtatDistributeur({ actif, nom, activer, retirer }: { actif: boolean; nom: string; activer: () => Promise<Retour>; retirer: () => Promise<Retour> }) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok?: string; erreur?: string } | null>(null);
  const basculer = () => {
    if (actif && !window.confirm(`Ne plus sélectionner « ${nom} » ? Ses vins n’auront plus de distributeur ; les commandes passées restent.`)) return;
    demarrer(async () => {
      const r = (await (actif ? retirer() : activer())) ?? null;
      if (r) { setMessage(r); setTimeout(() => setMessage(null), 5000); }
    });
  };
  return (
    <>
      <button type="button" role="switch" aria-checked={actif} disabled={enCours} onClick={basculer}
        className={`interrupteur${actif ? ' actif' : ''}`} aria-label={`${nom} : ${actif ? 'actif' : 'non sélectionné'}`} title={actif ? 'Actif : cliquez pour désactiver' : 'Non sélectionné : cliquez pour activer'}>
        <span className="interrupteur-rond" aria-hidden="true">{actif ? '✓' : '✕'}</span>
      </button>
      {message && <span role="status" className={`toast-admin ${message.erreur ? 'erreur' : ''}`} onClick={() => setMessage(null)}>{message.erreur ?? message.ok}</span>}
    </>
  );
}
