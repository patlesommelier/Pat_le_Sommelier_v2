'use client';
// Vignette d'un vin : sa photo ; si elle manque ou ne se charge pas, le logo de son distributeur ; sinon une bouteille.
import { useState } from 'react';
import { Icone } from './Icone';

export function VignetteVin({ url, logo, taille = 52 }: { url: string | null | undefined; logo?: string | null; taille?: number }) {
  const sources = [url, logo].filter((x): x is string => Boolean(x && x.trim()));
  const [rang, setRang] = useState(0);
  const src = sources[rang];
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img className={`vignette${src === logo ? ' vignette-logo' : ''}`} src={src} alt="" style={{ width: taille, height: taille }} onError={() => setRang((r) => r + 1)} />;
  return <span className="vignette vide" style={{ width: taille, height: taille }} aria-hidden="true"><Icone nom="bottle" taille={22} /></span>;
}
