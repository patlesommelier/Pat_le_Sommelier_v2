'use client';
// Case « Proposé » d'un plat dans la liste du menu : cochée, le plat est dans l'app ; enregistrée aussitôt.
// Elle est dans la ligne qui déroule le plat : un clic sur la case ne le déroule pas.
import { useState, useTransition } from 'react';
import type { Retour } from './FormulaireAdmin';

export function CaseProposee({ actif, nom, basculer }: { actif: boolean; nom: string; basculer: (actif: boolean) => Promise<Retour> }) {
  const [coche, setCoche] = useState(actif);
  const [enCours, demarrer] = useTransition();
  return (
    <span className="case-proposee" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={coche} disabled={enCours} aria-label={`Proposer « ${nom} » à vos clients`}
        onChange={(e) => {
          const v = e.target.checked;
          setCoche(v);
          demarrer(async () => { const r = await basculer(v); if (r?.erreur) setCoche(!v); });
        }} />
    </span>
  );
}
