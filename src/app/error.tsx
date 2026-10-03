'use client';

import { useEffect } from 'react';

// Filet de sécurité : une erreur serveur (base injoignable, données pas encore importées…) affiche
// un message lisible au lieu de « Application error ». Le détail reste dans les logs Netlify.
export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="ecran">
      <main className="defile">
        <div className="contenu" style={{ textAlign: 'center', alignItems: 'center' }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Pat est momentanément indisponible</h1>
          <p style={{ margin: 0 }}>La carte des vins n’a pas pu être chargée. Merci de réessayer dans un instant.</p>
          <button type="button" className="bouton-plein" onClick={reset}>
            Réessayer
          </button>
          {error.digest && <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Référence : {error.digest}</p>}
        </div>
      </main>
    </div>
  );
}
