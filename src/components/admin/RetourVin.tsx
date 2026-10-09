'use client';
// Retour sur la liste des vins après l'enregistrement d'une fiche : la ligne du vin est centrée à l'écran
// et un petit message confirme l'enregistrement en bas de l'écran.
import { useEffect, useState } from 'react';

export function RetourVin({ vinId, message }: { vinId: string; message: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    document.getElementById(`vin-${vinId}`)?.scrollIntoView({ block: 'center' });
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [vinId, message]);
  return visible ? <span role="status" aria-live="polite" className="toast-admin" onClick={() => setVisible(false)}>{message}</span> : null;
}
