'use client';
// Fiche d'un producteur (super-admin) : le regrouper dans un autre (doublon), après confirmation.
// « cible » : le nom du producteur gardé, choisi dans les propositions ou dans la liste de tous les producteurs.
import { useState } from 'react';

export function FormulaireRegroupement({ action, nom, propositions, tous }: {
  action: (f: FormData) => void | Promise<void>; nom: string;
  propositions: { id: string; nom: string; detail: string }[]; tous: string[];
}) {
  const [cible, setCible] = useState('');
  return (
    <form action={action} className="pile" style={{ gap: 10 }}
      onSubmit={(e) => { if (!window.confirm(`Regrouper « ${nom} » dans « ${cible} » ?\n\nSes vins passeront à « ${cible} » et « ${nom} » sera retiré de la base.`)) e.preventDefault(); }}>
      {propositions.length > 0 && (
        <div className="pile" style={{ gap: 6 }}>
          <span className="petit">Producteurs au nom proche :</span>
          {propositions.map((p) => (
            <label key={p.id} className="case" style={{ margin: 0 }}>
              <input type="radio" name="choix" checked={cible === p.nom} onChange={() => setCible(p.nom)} />
              <span><b>{p.nom}</b><small>{p.detail}</small></span>
            </label>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div className="champ" style={{ flex: '1 1 320px', margin: 0 }}><label htmlFor="cible">Producteur à garder</label>
          <input id="cible" name="cible" list="tous-producteurs" value={cible} onChange={(e) => setCible(e.target.value)} placeholder="Tapez son nom…" required /></div>
        <datalist id="tous-producteurs">{tous.map((n) => <option key={n} value={n} />)}</datalist>
        <button className="btn sec" disabled={!cible.trim()}>Regrouper</button>
      </div>
    </form>
  );
}
