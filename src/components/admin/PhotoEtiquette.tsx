'use client';
// Étiquette d'un vin dans la fiche du back-office : la photo choisie s'affiche tout de suite, avant l'enregistrement,
// et un clic sur la vignette l'ouvre en grand pour vérifier que c'est la bonne.
import { useEffect, useState, type ReactNode } from 'react';
import { Vignette } from './Ui';

export function PhotoEtiquette({ url, children }: { url: string | null; children: ReactNode }) {
  const [apercu, setApercu] = useState<string | null>(null);
  const [grand, setGrand] = useState(false);
  const image = apercu ?? url;
  useEffect(() => {
    if (!grand) return;
    const fermer = (e: KeyboardEvent) => { if (e.key === 'Escape') setGrand(false); };
    window.addEventListener('keydown', fermer);
    return () => window.removeEventListener('keydown', fermer);
  }, [grand]);
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 14, borderRadius: 14, border: '1px solid var(--ligne)', background: 'var(--fond)' }}>
      {image
        ? <button type="button" onClick={() => setGrand(true)} aria-label="Voir l’étiquette en grand" title="Voir en grand"
            style={{ padding: 0, border: 0, background: 'none', cursor: 'zoom-in', flexShrink: 0 }}><Vignette url={image} taille={104} /></button>
        : <Vignette url={null} taille={104} />}
      {grand && image && (
        <div role="dialog" aria-modal="true" aria-label="Étiquette en grand" onClick={() => setGrand(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20, 8, 12, 0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Étiquette du vin" style={{ maxWidth: 'min(900px, 100%)', maxHeight: '100%', objectFit: 'contain', background: '#FFF', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
          <button type="button" onClick={() => setGrand(false)} aria-label="Fermer"
            style={{ position: 'absolute', top: 16, right: 20, border: 0, background: 'none', color: '#FFF', fontSize: 34, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
      )}
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
