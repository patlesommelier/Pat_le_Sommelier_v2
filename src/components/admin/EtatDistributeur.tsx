'use client';
// Distributeur Quid Vinum (page Distributeurs du restaurant) : une liste « Actif / Non sélectionné » à droite de son nom.
// Le passer « Non sélectionné » demande confirmation (ses vins n'auront plus de distributeur).
import { useState, useTransition } from 'react';

type Retour = { ok?: string; erreur?: string } | void;

export function EtatDistributeur({ actif, nom, activer, retirer }: { actif: boolean; nom: string; activer: () => Promise<Retour>; retirer: () => Promise<Retour> }) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok?: string; erreur?: string } | null>(null);
  const changer = (valeur: string) => {
    if ((valeur === 'actif') === actif) return;
    if (valeur !== 'actif' && !window.confirm(`Ne plus sélectionner « ${nom} » ? Ses vins n’auront plus de distributeur ; les commandes passées restent.`)) return;
    demarrer(async () => {
      const r = (await (valeur === 'actif' ? activer() : retirer())) ?? null;
      if (r) { setMessage(r); setTimeout(() => setMessage(null), 5000); }
    });
  };
  return (
    <>
      <select key={String(actif)} defaultValue={actif ? 'actif' : 'non'} disabled={enCours} onChange={(e) => changer(e.target.value)}
        aria-label={`Sélection de ${nom}`} className={`choix-etat${actif ? ' actif' : ''}`}>
        <option value="actif">Actif</option>
        <option value="non">Non sélectionné</option>
      </select>
      {message && <span role="status" className={`toast-admin ${message.erreur ? 'erreur' : ''}`} onClick={() => setMessage(null)}>{message.erreur ?? message.ok}</span>}
    </>
  );
}
