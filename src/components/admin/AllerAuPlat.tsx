'use client';
// Après l'ajout d'un plat : la page se place sur le nouveau plat (mis en évidence) dans la liste complète du menu ;
// sans plat à montrer, elle revient en haut (message de confirmation).
import { useEffect } from 'react';

export function AllerAuPlat({ id }: { id: string | null }) {
  useEffect(() => {
    const el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ block: 'center' }); else window.scrollTo({ top: 0 });
  }, [id]);
  return null;
}
