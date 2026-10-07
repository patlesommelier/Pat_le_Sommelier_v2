// Téléphone de démonstration : la vraie page d'accueil de l'app du restaurant de démo « Chez Pat »,
// affichée dans le cadre du téléphone (le visiteur peut y choisir un plat et faire défiler).
const DEMO = '/chez-pat';
const ECRAN = { largeur: 278, hauteur: 590 }; // écran du cadre de 300 × 612 px
const APP = { largeur: 375, hauteur: Math.round(590 * (375 / 278)) }; // l'app rendue à la taille d'un vrai téléphone, puis réduite

/** Cadre dessiné à 300 × 612 puis réduit : `echelle` 0,75 donne 225 × 459 px. */
export function TelephoneDemo({ echelle = 0.75 }: { echelle?: number }) {
  return (
    <div style={{ width: 300 * echelle, height: 612 * echelle, flexShrink: 0 }}>
      <div style={{ width: 300, height: 612, transform: `scale(${echelle})`, transformOrigin: 'top left' }}>
        <div style={{ width: 300, height: 612, boxSizing: 'border-box', padding: 11, borderRadius: 48,
          background: 'linear-gradient(145deg, #3A2A2F, #120A0D)', boxShadow: '0 40px 70px -30px rgba(0,0,0,0.75), inset 0 0 0 1.5px rgba(255,255,255,0.12)' }}>
          <div style={{ width: ECRAN.largeur, height: ECRAN.hauteur, borderRadius: 38, overflow: 'hidden', background: '#FFF' }}>
            <iframe src={DEMO} title="L’app de démonstration Chez Pat" loading="lazy"
              style={{ width: APP.largeur, height: APP.hauteur, border: 0, transform: `scale(${ECRAN.largeur / APP.largeur})`, transformOrigin: 'top left' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
