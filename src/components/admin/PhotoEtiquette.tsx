'use client';
// Étiquette d'un vin dans la fiche du back-office, en grand : la photo choisie s'affiche tout de suite, avant l'enregistrement,
// et un clic sur la vignette l'ouvre en grand pour vérifier que c'est la bonne.
import { useEffect, useState, type ReactNode } from 'react';
import { Icone } from './Icone';

export function PhotoEtiquette({ url, children, champ = 'etiquette', alt = 'Étiquette du vin', hauteur = 320 }: {
  url: string | null; children: ReactNode;
  /** Nom du champ du fichier (« etiquette » ; « photo » pour la photo d'un plat), texte de l'image, hauteur de l'aperçu. */
  champ?: string; alt?: string; hauteur?: number;
}) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14, borderRadius: 14, border: '1px solid var(--ligne)', background: 'var(--fond)' }}>
      {image
        ? <button type="button" onClick={() => setGrand(true)} aria-label={`Voir en grand : ${alt.toLowerCase()}`} title="Voir en grand"
            style={{ padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={alt} style={{ display: 'block', width: '100%', height: hauteur, objectFit: 'contain', background: '#FFF', borderRadius: 10, border: '1px solid #EEE6E8' }} />
          </button>
        : <span className="vignette vide" style={{ width: '100%', height: Math.min(200, hauteur) }} aria-hidden="true"><Icone nom="bottle" taille={36} /></span>}
      {grand && image && (
        <div role="dialog" aria-modal="true" aria-label={alt} onClick={() => setGrand(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20, 8, 12, 0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={alt} style={{ maxWidth: 'min(900px, 100%)', maxHeight: '100%', objectFit: 'contain', background: '#FFF', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
          <button type="button" onClick={() => setGrand(false)} aria-label="Fermer"
            style={{ position: 'absolute', top: 16, right: 20, border: 0, background: 'none', color: '#FFF', fontSize: 34, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
      )}
      <div className="champ" style={{ minWidth: 0, alignItems: 'flex-start' }}>
        {children}
        {apercu && <span className="petit discret">Nouvelle photo : elle sera gardée à l’enregistrement.</span>}
        <input id={champ} name={champ} aria-label="Choisir une photo" type="file" accept="image/png,image/jpeg,image/webp" capture="environment"
          style={{ minHeight: 0, padding: 8, width: '100%', maxWidth: '100%' }}
          onChange={async (e) => {
            const champFichier = e.currentTarget;
            let f = champFichier.files?.[0];
            if (f && f.size > 1_500_000) {
              // Photo de téléphone (souvent plus de 5 Mo) : réduite avant l'envoi, sinon le serveur la refuse.
              const reduite = await reduire(f).catch(() => null);
              if (reduite) { const dt = new DataTransfer(); dt.items.add(reduite); champFichier.files = dt.files; f = reduite; }
            }
            setApercu(f ? URL.createObjectURL(f) : null);
          }} />
      </div>
    </div>
  );
}

/** Photo ramenée à 1600 px de côté au plus, en JPEG. */
async function reduire(f: File): Promise<File> {
  const img = await createImageBitmap(f);
  const echelle = Math.min(1, 1600 / Math.max(img.width, img.height));
  const toile = document.createElement('canvas');
  toile.width = Math.round(img.width * echelle); toile.height = Math.round(img.height * echelle);
  toile.getContext('2d')!.drawImage(img, 0, 0, toile.width, toile.height);
  const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, 'image/jpeg', 0.85));
  if (!blob) throw new Error('réduction impossible');
  return new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
