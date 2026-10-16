'use client';
// Page d'accueil : deux bulles de conversation qui flottent autour de Pat attablé. Un client demande quoi boire
// avec un plat, Pat répond ; la question et la réponse changent toutes les 9 secondes (le temps de les lire).
import { useEffect, useState } from 'react';
import s from './carnet.module.css';

// Plats et vins de la carte du restaurant de démo Chez Pat, d'après les accords que Pat y a établis
// (choix de Pat : pas de bordeaux, et l'on ne parle pas de friture).
const ECHANGES: [string, string][] = [
  ['le filet pur au poivre vert', 'Le Moulin-à-Vent Les Michelons de Jules Desjourneys : des tanins fondus et de la fraîcheur, le lien parfait entre la crème et le poivre.'],
  ['les solettes meunière', 'Le Petit Chablis Pas Si Petit : un chardonnay tendu, sans bois, qui coupe le beurre noisette et respecte la sole.'],
  ['le carpaccio de bœuf', 'Le Gevrey-Chambertin Justice Seuvrées de Perrot-Minot : un pinot noir tendu qui relance chaque bouchée.'],
  ['l’émincé de bar', 'Le Sancerre d’Henri Bourgeois : un sauvignon salin, de bord d’eau, avec le bar cru et le citron vert.'],
  ['le risotto aux champignons', 'Le Moulin-à-Vent Les Michelons : ses notes de sous-bois répondent aux champignons, et le parmesan ne durcit pas ses tanins.'],
];

export function BullesPat() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setN((x) => (x + 1) % ECHANGES.length), 9000);
    return () => clearInterval(t);
  }, []);
  const [plat, reponse] = ECHANGES[n];
  return (
    <>
      <p key={`q${n}`} className={`${s.bulle} ${s.bulleClient}`}>« Que boire avec {plat} ? »</p>
      <p key={`r${n}`} className={`${s.bulle} ${s.bullePat}`}>{reponse}</p>
    </>
  );
}
