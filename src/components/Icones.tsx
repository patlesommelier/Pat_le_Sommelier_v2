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
 * « Pat » écrit comme dans le logo (les trois lettres seules), tout petit en bas à droite du bandeau d'accueil :
 * blanc sur un bandeau foncé, rouge sur un bandeau clair (--tete-pat, posé par le layout du restaurant).
 */
export const PatEcrit = () => (
  <svg className="pat-ecrit" viewBox="584 451 290 137" role="img" aria-label="Pat, le sommelier" fill="var(--tete-pat, #FFFFFF)">
    <path d="M 653.3 504.9 C 651.6 507.8 649.2 510.0 646.1 511.6 C 643.1 513.1 639.7 513.8 636.1 513.8 L 614.2 513.8 L 614.2 474.9 L 636.1 474.9 C 639.7 474.9 643.1 475.7 646.1 477.2 C 649.2 478.7 651.6 480.9 653.3 483.8 C 655.1 486.8 656.0 490.2 656.0 494.3 C 656.0 498.5 655.1 502.0 653.3 504.9 M 663.4 456.9 C 656.6 453.5 648.9 451.8 640.4 451.8 L 584.4 451.8 L 584.4 585.8 L 614.2 585.8 L 614.2 537.0 L 640.4 537.0 C 648.9 537.0 656.6 535.3 663.4 531.8 C 670.2 528.3 675.7 523.4 679.6 517.0 C 683.6 510.6 685.6 503.0 685.6 494.3 C 685.6 485.6 683.6 478.0 679.6 471.6 C 675.7 465.2 670.2 460.3 663.4 456.9 " />
    <path d="M 723.7 528.3 C 725.5 525.0 728.0 522.4 731.1 520.6 C 734.2 518.8 737.8 517.8 741.8 517.8 C 745.9 517.8 749.4 518.8 752.5 520.6 C 755.6 522.4 758.0 525.0 759.8 528.3 C 761.5 531.6 762.3 535.4 762.3 539.7 C 762.3 546.0 760.4 551.2 756.6 555.3 C 752.8 559.4 747.8 561.5 741.6 561.5 C 737.7 561.5 734.2 560.5 731.0 558.6 C 727.8 556.8 725.4 554.2 723.6 550.9 C 721.8 547.6 720.9 543.8 720.9 539.7 C 720.9 535.4 721.8 531.6 723.7 528.3 M 713.1 581.4 C 719.7 585.6 727.3 587.7 735.7 587.7 C 741.9 587.7 747.6 586.5 752.6 584.1 C 755.9 582.5 758.7 580.6 761.2 578.3 L 761.2 585.8 L 789.7 585.8 L 789.7 493.5 L 761.2 493.5 L 761.2 501.2 C 758.7 498.8 755.8 496.8 752.5 495.2 C 747.5 492.8 741.9 491.6 735.7 491.6 C 727.3 491.6 719.7 493.7 713.1 497.9 C 706.4 502.1 701.2 507.8 697.3 515.0 C 693.4 522.2 691.5 530.4 691.5 539.7 C 691.5 548.9 693.4 557.1 697.3 564.3 C 701.2 571.6 706.4 577.3 713.1 581.4 " />
    <path d="M 852.3 493.5 L 852.3 455.4 L 823.3 455.4 L 823.3 493.5 L 802.4 493.5 L 802.4 518.2 L 823.3 518.2 L 823.3 585.8 L 852.3 585.8 L 852.3 518.2 L 873.2 518.2 L 873.2 493.5 Z M 852.3 493.5 " />
  </svg>
);
