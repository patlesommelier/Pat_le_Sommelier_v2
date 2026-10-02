'use client';

/** Bouton qui pré-remplit la barre « Demandez à Pat » avec une question. */
export function DemanderAPat({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <button type="button" className="bouton-plein" onClick={() => window.dispatchEvent(new CustomEvent('pat:demander', { detail: question }))}>
      {children}
    </button>
  );
}
