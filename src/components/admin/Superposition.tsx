'use client';
// Fenêtre en superposition (dialog) ouverte par un bouton : son contenu (un formulaire) reste dans la page.
// « ouvert » l'ouvre d'office (lien direct) ; Échap ou « Fermer » la ferment.
import { useEffect, useRef, type ReactNode } from 'react';

export function Superposition({ bouton, titre, ouvert = false, children }: { bouton: string; titre: string; ouvert?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (ouvert && !ref.current?.open) ref.current?.showModal(); }, [ouvert]);
  return (
    <>
      <button type="button" className="btn" onClick={() => ref.current?.showModal()}>{bouton}</button>
      <dialog ref={ref} className="superposition" aria-label={titre}>
        <div className="superposition-tete"><h2>{titre}</h2>
          <button type="button" className="btn fantome petit" onClick={() => ref.current?.close()} aria-label="Fermer">✕ Fermer</button></div>
        <div className="superposition-corps">{children}</div>
      </dialog>
    </>
  );
}
