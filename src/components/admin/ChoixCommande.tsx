'use client';
// Nouvelle commande (fenêtre) : une liste déroulante « Chez quel distributeur ? », puis le formulaire de ce distributeur
// (les formulaires sont tous dans la page ; seul celui choisi est affiché).
import { createContext, useContext, useState, type ReactNode } from 'react';

const Choisi = createContext<string>('');

export function ChoixCommande({ options, initial, children }: { options: { id: string; libelle: string }[]; initial?: string; children: ReactNode }) {
  const [choix, setChoix] = useState(initial && options.some((o) => o.id === initial) ? initial : options.length === 1 ? options[0].id : '');
  return (
    <div className="pile" style={{ gap: 16 }}>
      <div className="champ" style={{ margin: 0, maxWidth: 480 }}>
        <label htmlFor="choix_commande">Chez quel distributeur ?</label>
        <select id="choix_commande" value={choix} onChange={(e) => setChoix(e.target.value)}>
          <option value="">— Choisir —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}
        </select>
      </div>
      <Choisi.Provider value={choix}>{children}</Choisi.Provider>
    </div>
  );
}

export function Panneau({ id, children }: { id: string; children: ReactNode }) {
  return <div hidden={useContext(Choisi) !== id}>{children}</div>;
}
