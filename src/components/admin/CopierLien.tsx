'use client';
import { useState } from 'react';
import { Icone } from './Icone';

export function CopierLien({ url }: { url: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="champ">
      <label htmlFor="lien">Lien direct</label>
      <span style={{ display: 'flex', gap: 8 }}>
        <input id="lien" readOnly value={url} style={{ flexGrow: 1, minWidth: 0, background: 'var(--fond)', fontSize: 14 }} />
        <button type="button" className="btn sec petit" aria-label="Copier le lien" onClick={async () => { await navigator.clipboard.writeText(url); setCopie(true); setTimeout(() => setCopie(false), 2000); }}>
          <Icone nom={copie ? 'check' : 'out'} taille={18} />{copie ? 'Copié' : 'Copier'}
        </button>
      </span>
    </div>
  );
}
