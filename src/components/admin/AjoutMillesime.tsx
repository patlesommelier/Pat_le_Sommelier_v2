'use client';
// Fiche du vin : « + Ajouter un millésime » ; au clic, un champ pour le millésime et le bouton qui crée la nouvelle ligne
// de Ma cave (même vin, autre millésime). Envoie le formulaire de la fiche vers l'action donnée (formAction).
import { useRef, useState } from 'react';

export function AjoutMillesime({ action }: { action: (f: FormData) => void | Promise<void> }) {
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  if (!ouvert) return <span><button type="button" className="btn sec petit" onClick={() => setOuvert(true)}>+ Ajouter un millésime</button></span>;
  return (
    <div className="ligne-actions" style={{ alignItems: 'flex-end' }}>
      <div className="champ" style={{ margin: 0, width: 160 }}>
        <label htmlFor="nouveau_millesime">Nouveau millésime</label>
        <input id="nouveau_millesime" name="nouveau_millesime" placeholder="Ex. 2023" maxLength={6} autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); bouton.current?.click(); } }} />
      </div>
      <button ref={bouton} type="submit" formAction={action} formNoValidate className="btn petit">Ajouter à ma cave</button>
      <button type="button" className="btn fantome petit" onClick={() => setOuvert(false)}>Annuler</button>
    </div>
  );
}
