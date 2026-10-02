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

/** Verre et bouteille stylisés en bas du bandeau d'accueil. */
export const Silhouettes = () => (
  <svg className="silhouettes" viewBox="0 0 390 70" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Silhouettes d’une bouteille et d’un verre">
    <g fill="#FFFFFF">
      <path d="M275 40 H295 C295 52 291 58 285 58 C279 58 275 52 275 40 Z M284 57 H286 V68 H284 Z M277 67.5 H293 V70 H277 Z" />
      <path d="M313 70 V42 C313 32 318 26 319 18 V6 H325 V18 C326 26 331 32 331 42 V70 Z" />
      <path d="M318.5 3 H325.5 V7 H318.5 Z" />
    </g>
  </svg>
);
