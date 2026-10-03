'use client';

/** Liste 1 à 5 qui enregistre la note dès qu'on la change (formulaire parent = action serveur). */
export function ChoixNote({ note, libelle }: { note: number; libelle: string }) {
  return (
    <select name="note" defaultValue={note} aria-label={`Note de ${libelle}`} onChange={(e) => e.currentTarget.form?.requestSubmit()}
      style={{ minHeight: 36, padding: '4px 8px', borderRadius: 8, border: '1.5px solid var(--ligne)', font: '700 14px Lato, sans-serif', color: 'var(--texte)', background: '#FFF' }}>
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}
