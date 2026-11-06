'use client';
// Page Inventaire : champ de stock avec − et + (pratique au téléphone, dans la cave), et recherche qui masque les autres vins
// sans perdre ce qui a déjà été compté (tout reste dans le formulaire).
import { useState } from 'react';

export function ChampStock({ id, stock, libelle }: { id: string; stock: number; libelle: string }) {
  const [n, setN] = useState(stock);
  const change = n !== stock;
  return (
    <span className={`champ-inventaire${change ? ' change' : ''}`}>
      <button type="button" aria-label={`Une bouteille de moins : ${libelle}`} onClick={() => setN((x) => Math.max(0, x - 1))}>−</button>
      <input type="number" name={`stock_${id}`} value={n} min={0} max={100000} inputMode="numeric" aria-label={`Bouteilles en stock : ${libelle}`}
        onChange={(e) => setN(Math.max(0, Math.min(100000, Math.round(Number(e.target.value) || 0))))} />
      <button type="button" aria-label={`Une bouteille de plus : ${libelle}`} onClick={() => setN((x) => Math.min(100000, x + 1))}>+</button>
    </span>
  );
}

/** Recherche dans l'inventaire : masque les lignes (data-recherche) qui ne contiennent pas le texte tapé. */
export function RechercheInventaire() {
  const filtrer = (q: string) => {
    const t = q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    for (const tr of document.querySelectorAll<HTMLElement>('[data-recherche]')) tr.hidden = Boolean(t) && !(tr.dataset.recherche ?? '').includes(t);
  };
  return <input type="search" className="recherche" placeholder="Chercher un vin…" aria-label="Chercher un vin dans l’inventaire" onChange={(e) => filtrer(e.target.value)} style={{ flex: '1 1 260px' }} />;
}
