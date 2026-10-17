export const Chevron = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const Livre = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5" />
    <path d="M20 19v3H6.5" />
  </svg>
);

/** Fourchette et couteau : retour au menu des plats. */
export const Couverts = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 2v20" /><path d="M4 2v6a3 3 0 0 0 6 0V2" /><path d="M17 22V2c-2.2 1.2-3.5 3.6-3.5 7v4H17" />
  </svg>
);

export const Micro = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const Envoyer = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const Bouteille = ({ taille = 22 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2h4v4c0 1.5 2 2.5 2 5v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V11c0-2.5 2-3.5 2-5z" />
    <path d="M8 13h8v5H8z" />
  </svg>
);

/**
 * Buste de Pat découpé (tête et col, coupé en arrondi), en bas à droite du bandeau d'accueil : blanche sur un bandeau foncé, rouge sur un bandeau clair
 * (--tete-pat, posé par le layout du restaurant). Le dessin (public/pat/pat-tete-decoupe.svg) sert de masque : le visage,
 * ajouré, laisse voir la couleur du bandeau.
 */
export const Silhouettes = () => (
  <div className="silhouettes" role="img" aria-label="Pat, le sommelier">
    <span className="tete-pat" />
  </div>
);
