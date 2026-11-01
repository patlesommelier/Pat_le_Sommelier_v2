'use client';
// Liste déroulante du fournisseur d'un vin (fiche du vin, page Vins) ; « + Nouveau fournisseur » ouvre un champ pour son nom.
// Liste non pilotée (defaultValue), recréée quand le fournisseur enregistré change : après l'enregistrement, React remet
// le formulaire à ses valeurs par défaut ; une liste pilotée réaffichait alors l'ancien fournisseur (et le renvoyait au
// prochain enregistrement).
import { useEffect, useState } from 'react';

export function SelectFournisseur({ nom, fournisseurs, valeur, compact }: {
  nom: string; fournisseurs: { id: string; nom: string }[]; valeur: string | null; compact?: boolean;
}) {
  const [choix, setChoix] = useState(valeur ?? '');
  useEffect(() => { setChoix(valeur ?? ''); }, [valeur]);
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: compact ? 150 : undefined }}>
      <select key={valeur ?? ''} name={nom} defaultValue={valeur ?? ''} onChange={(e) => setChoix(e.target.value)} aria-label="Fournisseur" style={compact ? { padding: '6px 8px', fontSize: 14 } : undefined}>
        <option value="">— Aucun —</option>
        {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        <option value="nouveau">+ Nouveau fournisseur…</option>
      </select>
      {choix === 'nouveau' && (
        <input name={nom.replace(/^fournisseur/, 'fournisseur_nouveau')} placeholder="Nom du fournisseur" aria-label="Nom du nouveau fournisseur" autoFocus
          maxLength={120} style={compact ? { padding: '6px 8px', fontSize: 14 } : undefined} />
      )}
    </span>
  );
}
