'use client';
// Page d'accueil : deux bulles de conversation qui flottent autour de Pat attablé. Un client demande quoi boire
// avec un plat, Pat répond ; la question et la réponse changent toutes les 9 secondes (le temps de les lire).
import { useEffect, useState } from 'react';
import s from './carnet.module.css';

const ECHANGES: [string, string][] = [
  ['un tartare de bœuf', 'Un Saint-Amour du Domaine Piron : un gamay frais qui ne couvre pas la viande crue.'],
  ['une sole meunière', 'Un Sancerre d’Henri Bourgeois : vif, il répond au beurre noisette.'],
  ['un steak au poivre', 'Un HB de Haut-Bailly : un bordeaux structuré qui tient tête au poivre.'],
  ['des croquettes aux crevettes', 'Un Ruinart Blanc de Blancs : les bulles nettoient la friture.'],
  ['un ris de veau', 'Un Gevrey-Chambertin de Perrot-Minot : la finesse du pinot noir épouse le ris de veau.'],
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
