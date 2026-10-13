'use client';
// Écran d'ouverture de l'app (identité de Pat) : à l'arrivée par le QR code, le carré rouge « Que boire avec ça ? »
// avec Pat qui sert le vin, une seconde et demie, puis l'app du restaurant. Une fois par visite (onglet) ; un toucher le passe.
import { useEffect, useState } from 'react';

export function OuverturePat({ restaurant, nom }: { restaurant: string; nom: string }) {
  const cle = `pat-ouverture-${restaurant}`;
  const [etat, setEtat] = useState<'cache' | 'visible' | 'sortie'>('cache');
  useEffect(() => {
    let deja = false;
    try { deja = sessionStorage.getItem(cle) === '1'; sessionStorage.setItem(cle, '1'); } catch { /* navigation privée : on l'affiche */ }
    if (deja) return;
    setEtat('visible');
    const t1 = setTimeout(() => setEtat('sortie'), 1500);
    const t2 = setTimeout(() => setEtat('cache'), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cle]);
  if (etat === 'cache') return null;
  return (
    <div className={`ouverture-pat${etat === 'sortie' ? ' sortie' : ''}`} role="presentation" onClick={() => setEtat('cache')}>
      <div className="ouverture-carre">
        <b>Que boire<br />avec ça&#8239;?</b>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat-illustration-bordeaux.svg" alt="" />
        <span>Pat le sommelier</span>
      </div>
      <small>chez {nom}</small>
    </div>
  );
}
