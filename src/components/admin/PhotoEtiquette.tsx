'use client';
// Étiquette d'un vin dans la fiche du back-office : la photo choisie s'affiche tout de suite, avant l'enregistrement.
import { useEffect, useState, type ReactNode } from 'react';
import { Vignette } from './Ui';

export function PhotoEtiquette({ url, children }: { url: string | null; children: ReactNode }) {
  const [apercu, setApercu] = useState<string | null>(null);
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 14, borderRadius: 14, border: '1px solid var(--ligne)', background: 'var(--fond)' }}>
      <Vignette url={apercu ?? url} taille={104} />
      <div className="champ" style={{ flex: 1, minWidth: 0 }}>
        {children}
        {apercu && <span className="petit discret">Nouvelle photo : elle sera gardée à l’enregistrement.</span>}
        <input id="etiquette" name="etiquette" aria-label="Remplacer par votre photo" type="file" accept="image/png,image/jpeg,image/webp" capture="environment"
          style={{ minHeight: 0, padding: 8, width: '100%', maxWidth: '100%' }}
          onChange={(e) => { const f = e.currentTarget.files?.[0]; setApercu(f ? URL.createObjectURL(f) : null); }} />
      </div>
    </div>
  );
}
