'use client';
// Super-admin — commande Quid Vinum en attente de validation : accepter, ou refuser avec une explication (lue par le restaurant).
import { useState } from 'react';

export function ChoixDecision({ id }: { id: string }) {
  const [decision, setDecision] = useState('');
  return (
    <span className="pile" style={{ gap: 8, alignItems: 'flex-end' }}>
      <span className="ligne-actions" style={{ alignItems: 'center' }}>
        <select name="decision" value={decision} onChange={(e) => setDecision(e.target.value)} aria-label="Décision sur la commande" className="champ-liste" style={{ width: 'auto' }} required>
          <option value="">Choisir…</option>
          <option value="accepter">Accepter la commande</option>
          <option value="refuser">Refuser la commande</option>
        </select>
        <button className="btn rouge petit" disabled={!decision}>Valider</button>
      </span>
      {decision === 'refuser' && (
        <span className="champ" style={{ margin: 0, minWidth: 'min(420px, 80vw)' }}>
          <label htmlFor={`motif-${id}`}>Pourquoi ? (le restaurant le lira)</label>
          <textarea id={`motif-${id}`} name="motif" rows={2} maxLength={500} required placeholder="Ex. Ce vin n’est plus disponible chez le distributeur ; minimum de 12 bouteilles non atteint." />
        </span>
      )}
    </span>
  );
}
