'use client';
// Page Inventaire : champ de stock avec − et + (pratique au téléphone, dans la cave).
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

