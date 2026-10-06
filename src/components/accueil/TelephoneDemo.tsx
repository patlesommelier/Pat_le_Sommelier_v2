// Téléphone de démonstration : l'écran « Mes propositions » de l'app de Lola (avec son accord).
// Images fournies dans /public/accueil/ (exportées du design).
const ROUGE = '#BA4037';

function Vin({ img, nom, sous, texte, prix }: { img: string; nom: string; sous: string; texte: string; prix: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: 10, border: '1px solid #DDD', background: '#FFF' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" width={70} height={70} style={{ objectFit: 'contain', border: '1px solid #EEE', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25 }}>{nom}</span>
        <span style={{ fontSize: 10.5, color: '#6B6B6B' }}>{sous}</span>
        <span style={{ fontSize: 11, lineHeight: 1.4 }}>{texte}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: ROUGE }}>{prix}</span>
      </div>
    </div>
  );
}

/** Rendu à 60 % : 180 × 367 px à l'écran. */
export function TelephoneDemo() {
  return (
    <div role="img" aria-label="L’app de Lola : Pat propose un Sancerre et un Petit Chablis pour des solettes meunière"
      style={{ width: 180, height: 367, flexShrink: 0 }}>
      <div style={{ width: 300, height: 612, transform: 'scale(0.6)', transformOrigin: 'top left' }}>
        <div style={{ width: 300, height: 612, boxSizing: 'border-box', padding: 11, borderRadius: 48,
          background: 'linear-gradient(145deg, #3A2A2F, #120A0D)', boxShadow: '0 40px 70px -30px rgba(0,0,0,0.75), inset 0 0 0 1.5px rgba(255,255,255,0.12)' }}>
          <div style={{ height: '100%', borderRadius: 38, overflow: 'hidden', background: '#FFF', display: 'flex', flexDirection: 'column', color: '#1A1A1A' }}>
            <div style={{ background: ROUGE, color: '#FFF', padding: '10px 18px' }}>
              <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                <span>21:14</span><span style={{ width: 84, height: 22, borderRadius: 12, background: '#000' }} /><span style={{ width: 44 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, minHeight: 46 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/accueil/lola-logo.png" alt="" width={76} height={38} />
                <span style={{ height: 26, display: 'flex', alignItems: 'center', padding: '0 8px', border: '1px solid #FFF', fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>Carte des vins</span>
              </div>
            </div>
            <div style={{ flex: 1, padding: '16px 14px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, textAlign: 'center' }}>
                <span style={{ fontSize: 22 }}>Mes propositions</span>
                <span style={{ width: 36, height: 1, background: ROUGE }} />
                <span style={{ fontSize: 12, fontStyle: 'italic', color: '#6B6B6B' }}>Pour vos solettes meunière</span>
              </div>
              <Vin img="/accueil/etiquette-sancerre.jpg" nom="Sancerre · Henri Bourgeois" sous="Sauvignon blanc · 2025"
                texte="Tendu et sans bois : son acidité coupe le beurre noisette et respecte la finesse de la sole." prix="58,00 €" />
              <Vin img="/accueil/etiquette-petit-chablis.jpg" nom="Petit Chablis · Pas Si Petit" sous="La Chablisienne · 2023"
                texte="Chardonnay vif et salin ; son élevage sur lies apporte le léger gras bienvenu sur la meunière." prix="46,00 €" />
              <span style={{ fontSize: 11, fontStyle: 'italic', color: '#6B6B6B', textAlign: 'center' }}>À servir à 10-11 °C</span>
            </div>
            <div style={{ padding: '8px 10px 16px', boxShadow: '0 -6px 18px rgba(0,0,0,0.10)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4, borderRadius: 26, background: '#FBF3F2', border: `1.5px solid ${ROUGE}` }}>
                <span style={{ width: 38, height: 38, borderRadius: 19, border: `1.5px solid ${ROUGE}`, boxSizing: 'border-box', background: '#FFF', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/pat-logo.png" alt="" width={30} height={33} />
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#4A4A4A' }}>Demandez à Pat…</span>
                <span style={{ width: 32, height: 32, borderRadius: 16, background: ROUGE }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
