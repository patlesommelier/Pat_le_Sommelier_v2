'use client';
// Vins à valider de la base de Pat : cases à cocher sur la liste, puis un seul bouton pour les valider ensemble.
// Les cases sont reliées au formulaire « valider-lot » par leur attribut form (la liste contient déjà d'autres formulaires).
import { useEffect, useState } from 'react';

const FORMULAIRE = 'valider-lot';
const cases = () => [...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form=${FORMULAIRE}][name=ids]`)];

/** Case de l'en-tête : coche ou décoche tous les vins à valider de la page. */
export function CocherTout() {
  const [tout, setTout] = useState(false);
  useEffect(() => {
    const maj = () => { const c = cases(); setTout(c.length > 0 && c.every((x) => x.checked)); };
    document.addEventListener('change', maj);
    return () => document.removeEventListener('change', maj);
  }, []);
  return (
    <input type="checkbox" aria-label="Cocher tous les vins à valider" checked={tout}
      onChange={(e) => { for (const c of cases()) c.checked = e.target.checked; setTout(e.target.checked); document.dispatchEvent(new Event('change')); }} />
  );
}

/** Bouton « Valider la sélection », visible dès qu'un vin est coché. */
export function BarreValidation({ action, retour }: { action: (f: FormData) => Promise<void>; retour: string }) {
  const [n, setN] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    const maj = () => setN(cases().filter((x) => x.checked).length);
    maj();
    document.addEventListener('change', maj);
    return () => document.removeEventListener('change', maj);
  }, []);
  return (
    <form id={FORMULAIRE} action={action} onSubmit={() => setEnvoi(true)} className="ligne-actions" style={{ visibility: n ? 'visible' : 'hidden' }}>
      <input type="hidden" name="retour" value={retour} />
      <button className="btn petit" disabled={envoi}>{envoi ? 'Validation…' : `Valider la sélection (${n} vin${n > 1 ? 's' : ''})`}</button>
    </form>
  );
}
