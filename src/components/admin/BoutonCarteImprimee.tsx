'use client';

import { useState } from 'react';
import { preparerImpression } from '@/app/admin/actions';

/**
 * « Imprimer la carte » dans un nouvel onglet. L'onglet est ouvert tout de suite (au clic, sinon le navigateur
 * le bloque), puis reçoit l'adresse : la page d'attente si Pat doit écrire des présentations, sinon la carte.
 */
export function BoutonCarteImprimee({ resto }: { resto: string }) {
  const [enCours, setEnCours] = useState(false);
  async function ouvrir() {
    setEnCours(true);
    const onglet = window.open('', '_blank');
    if (onglet) onglet.document.write('<p style="font:16px Lato,sans-serif;padding:24px">Préparation de la carte…</p>');
    try {
      const adresse = await preparerImpression(resto);
      if (onglet) onglet.location.href = adresse;
      else window.location.href = adresse;
    } catch {
      onglet?.close();
      alert('La carte n’a pas pu être préparée. Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  }
  return <button type="button" className="btn sec" onClick={ouvrir} disabled={enCours}>{enCours ? 'Préparation…' : 'Imprimer la carte'}</button>;
}
