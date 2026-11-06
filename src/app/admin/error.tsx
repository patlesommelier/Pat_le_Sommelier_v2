'use client';
// Erreur dans l'espace d'administration : un message et un bouton pour recharger, plutôt qu'une page blanche.
// Page restée ouverte pendant une mise en ligne : ses boutons ne correspondent plus au serveur ; on recharge tout seul.
import { useEffect } from 'react';

export default function ErreurAdmin({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const perimee = /Server Action .* was not found|failed-to-find-server-action/i.test(error.message);
  useEffect(() => { if (perimee) window.location.reload(); }, [perimee]);
  return (
    <div className="carte-bo pile" style={{ gap: 12, maxWidth: 640, margin: '40px auto' }}>
      <h2 style={{ margin: 0 }}>{perimee ? 'Mise à jour de la page…' : 'Une erreur est survenue'}</h2>
      <p style={{ margin: 0 }}>{perimee
        ? 'Le site vient d’être mis à jour : la page se recharge. Refaites ensuite votre dernière action.'
        : 'L’action n’a pas pu aboutir. Rechargez la page et réessayez ; si cela recommence, notez l’heure et le code ci-dessous.'}</p>
      {!perimee && error.digest && <p className="petit discret" style={{ margin: 0 }}>Code : {error.digest}</p>}
      <div className="ligne-actions">
        <button className="btn" onClick={() => window.location.reload()}>Recharger la page</button>
        {!perimee && <button className="btn sec" onClick={reset}>Réessayer</button>}
      </div>
    </div>
  );
}
