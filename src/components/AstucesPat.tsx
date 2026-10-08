'use client';
// Pendant la préparation des accords, à la place de « Pat prépare vos accords » : les possibilités de la plateforme
// et l'attente des étiquettes, l'une après l'autre (fondu toutes les 7 secondes).
import { useEffect, useState } from 'react';

const ASTUCES = [
  'Pat prépare vos accords : il étudie chaque vin de votre carte avec chacun de vos plats.',
  'Pat va aussi chercher les étiquettes de vos vins : il faudra peut-être quelques heures pour toutes les trouver.',
  'À table, vos clients scannent le QR code, choisissent leur plat, et Pat leur propose les vins de votre carte qui s’y accordent le mieux.',
  'Vos clients peuvent aussi écrire à Pat : il leur répond avec les vins de vos accords, étiquette et explication à l’appui.',
  'Dans votre espace, vous relisez chaque accord : changez une note ou réécrivez un commentaire, Pat suit vos choix.',
  'Une rupture ? Décochez « Disponible » dans la carte des vins : Pat ne propose plus ce vin, tout de suite.',
  'Mettez en avant vos coups de cœur : cochez « Coup de cœur de la maison » sur un vin de votre carte.',
  'Règles du sommelier : ajustez le nombre de vins proposés et la manière dont Pat les choisit.',
  'Imprimez une belle carte des vins, avec votre logo, le QR code et une présentation de chaque vin écrite par Pat.',
  'Apparence : ajoutez votre logo et votre couleur, l’app de vos clients s’habille aux couleurs de votre restaurant.',
];

export function AstucesPat({ className }: { className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x + 1) % ASTUCES.length), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`astuces-pat ${className ?? ''}`} aria-live="polite">
      <span key={n} className="astuce">{ASTUCES[n]}</span>
      <span className="points" aria-hidden="true">{ASTUCES.map((_, i) => <i key={i} className={i === n ? 'actif' : ''} />)}</span>
    </span>
  );
}
