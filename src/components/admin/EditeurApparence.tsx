'use client';
import { useMemo, useState } from 'react';
import { FormulaireAdmin, type Retour } from './FormulaireAdmin';

const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (h: string) => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const claire = (h: string) => { const [r, g, b] = rgb(h); return hex(r + (255 - r) * 0.93, g + (255 - g) * 0.93, b + (255 - b) * 0.93); };
const valide = (h: string) => /^#[0-9a-f]{6}$/i.test(h);

interface Props {
  action: (f: FormData) => Promise<Retour>;
  nom: string; couleur: string; logo: string | null; logoFonce: string | null; logoChoix: string | null; accroche: string | null;
  /** Section « Couleur des impressions », rendue par la page (avec la couleur trouvée dans le logo). */
  impression?: React.ReactNode;
  /** Page d'arrivée de l'app : 'menu' ou 'carte'. */
  pageAccueil?: string;
  /** Mise en page de l'app des clients : 'creme' (par défaut), 'classique' ou 'sombre'. */
  miseEnPage?: MiseEnPage;
  plats: string[];
}

export function EditeurApparence({ action, nom, couleur: initiale, logo, logoFonce, logoChoix, accroche, pageAccueil = 'menu', miseEnPage = 'creme', plats, impression }: Props) {
  const [mise, setMise] = useState<MiseEnPage>(miseEnPage);
  const [couleur, setCouleur] = useState(initiale.toUpperCase());
  const [saisie, setSaisie] = useState(initiale.toUpperCase());
  const [apercuLogo, setApercuLogo] = useState<string | null>(logo);
  const [apercuLogoFonce, setApercuLogoFonce] = useState<string | null>(logoFonce);
  // Logo affiché dans l'app : choisi ici ; sans choix enregistré, celui que l'app prenait automatiquement.
  const [choix, setChoix] = useState<'clair' | 'fonce'>(() => {
    const prefereFonce = logoChoix ? logoChoix === 'fonce' : 1.05 / (lum(initiale) + 0.05) < 3;
    return prefereFonce ? (logoFonce || !logo ? 'fonce' : 'clair') : (logo || !logoFonce ? 'clair' : 'fonce');
  });
  const [l1, l2] = (accroche ?? `Bienvenue chez ${nom},|je vous aide à choisir le vin`).split('|');
  const [a1, setA1] = useState(l1 ?? '');
  const [a2, setA2] = useState(l2 ?? '');

  const contraste = useMemo(() => 1.05 / (lum(couleur) + 0.05), [couleur]);
  const fondClair = contraste < 3;
  const texte = fondClair ? '#1A1A1A' : '#FFFFFF';
  const logoAffiche = choix === 'fonce' ? apercuLogoFonce ?? apercuLogo : apercuLogo ?? apercuLogoFonce;

  const choisir = (h: string) => { setCouleur(h); setSaisie(h); };

  return (
    <FormulaireAdmin action={action} className="rangee">
      <input type="hidden" name="couleur" value={couleur} />
      <input type="hidden" name="logo_choix" value={choix} />
      <div className="large" style={{ gap: 24 }}>
        {/* Un seul logo : celui affiché en haut de l'app, montré sur la couleur de l'app. En déposer un nouveau le remplace partout. */}
        <section className="carte-bo pile">
          <div><h2>Logo</h2><p className="sous">Votre logo (PNG ou SVG, de préférence à fond transparent), tel qu’il s’affiche en haut de l’app, sur votre couleur.</p></div>
          <input type="hidden" name="logo_unique" value="1" />
          <span style={{ height: 120, maxWidth: 420, borderRadius: 14, background: couleur, border: '1px solid var(--ligne)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoAffiche ? <img src={logoAffiche} alt="Logo actuel" style={{ maxWidth: 220, maxHeight: 90 }} /> : <span style={{ color: texte, opacity: 0.8 }}>Aucun logo</span>}
          </span>
          <div className="champ" style={{ maxWidth: 420 }}>
            <label htmlFor="logo">{logoAffiche ? 'Remplacer le logo' : 'Déposer le logo'}</label>
            <input id="logo" name="logo" type="file" accept="image/png,image/svg+xml,image/webp" style={{ padding: 8 }}
              onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) { setApercuLogo(URL.createObjectURL(f)); setApercuLogoFonce(null); setChoix('clair'); } }} />
            {fondClair && <span className="aide">Votre couleur est claire : un logo foncé s’y lira mieux.</span>}
          </div>
        </section>
        <section className="carte-bo pile">
          <div><h2>Couleur de l’app</h2><p className="sous">Saisissez le code de votre couleur, ou choisissez-la avec le carré de couleur (sa pipette permet de la prendre sur votre logo).</p></div>
          <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', alignItems: 'start' }}>
            <div className="pile" style={{ gap: 12 }}>
              <div className="champ"><label htmlFor="hex">Votre couleur (code)</label>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input id="hex" value={saisie} onChange={(e) => { const v = e.target.value.toUpperCase(); setSaisie(v); if (valide(v)) setCouleur(v); }} style={{ width: 130, fontFamily: 'monospace' }} />
                  <input type="color" aria-label="Choisir une couleur" value={couleur.toLowerCase()} onChange={(e) => choisir(e.target.value.toUpperCase())} style={{ width: 48, height: 44, padding: 2, border: '1.5px solid var(--ligne)', borderRadius: 10, background: '#EFEBE9' }} />
                </span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--ligne)', paddingTop: 14, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ width: 28, height: 28, borderRadius: 8, background: couleur, border: '1px solid #AFB0AE' }} /><span><span className="discret" style={{ fontSize: 13 }}>Couleur principale</span><br /><b style={{ fontFamily: 'monospace' }}>{couleur}</b></span></span>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ width: 28, height: 28, borderRadius: 8, background: claire(couleur), border: '1px solid #AFB0AE' }} /><span><span className="discret" style={{ fontSize: 13 }}>Couleur claire (barre de Pat), calculée</span><br /><b style={{ fontFamily: 'monospace' }}>{claire(couleur)}</b></span></span>
          </div>
          {contraste >= 4.5 && <span style={{ color: 'var(--vert)', fontSize: 14 }}>Texte blanc bien lisible sur cette couleur (contraste {contraste.toFixed(1).replace('.', ',')} : 1).</span>}
          {contraste >= 3 && contraste < 4.5 && <span style={{ color: 'var(--ocre)', fontSize: 14 }}><b>Lisibilité limitée</b> (contraste {contraste.toFixed(1).replace('.', ',')} : 1) : les petits textes blancs fatiguent. Une teinte un peu plus foncée serait plus confortable.</span>}
          {fondClair && <span style={{ color: '#680021', fontSize: 14 }}><b>Couleur claire</b> (contraste {contraste.toFixed(1).replace('.', ',')} : 1) : l’app écrit en foncé ; un logo foncé s’y lira mieux.</span>}
        </section>
        {/* Mise en page de l'app : trois choix, chacun avec son aperçu aux couleurs et au logo du restaurant. */}
        <section className="carte-bo pile">
          <div><h2>Mise en page de l’app</h2><p className="sous">Choisissez l’allure de l’app que vos clients ouvrent avec le QR code. Elle garde toujours votre couleur et votre logo.</p></div>
          <div role="radiogroup" aria-label="Mise en page de l’app" className="choix-mise-en-page">
            {MISES_EN_PAGE.map(([cle, titre, detail]) => (
              <label key={cle} className="mise-en-page" data-choisie={mise === cle ? 'oui' : undefined}>
                <span className="mise-en-page-apercu" aria-hidden="true">
                  <ApercuApp mise={cle} couleur={couleur} texte={texte} logo={logoAffiche} nom={nom} a1={a1} a2={a2} plats={plats} />
                </span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {/* defaultChecked (pas checked) : après l'enregistrement, le formulaire revient à l'état par défaut ; il suit ainsi le choix fait. */}
                  <input type="radio" name="design_app" value={cle} defaultChecked={mise === cle} onChange={() => setMise(cle)} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
                  <span className="pile" style={{ gap: 2 }}><b>{titre}</b><small className="discret">{detail}</small></span>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className="carte-bo pile">
          <h2>Message d’accueil</h2>
          <div className="champ"><label htmlFor="accroche1">Première ligne</label><input id="accroche1" name="accroche1" value={a1} onChange={(e) => setA1(e.target.value)} maxLength={40} /></div>
          <div className="champ"><label htmlFor="accroche2">Deuxième ligne</label><input id="accroche2" name="accroche2" value={a2} onChange={(e) => setA2(e.target.value)} maxLength={60} /></div>
        </section>
        <section className="carte-bo pile">
          <h2>Page d’arrivée</h2>
          <span className="discret">Ce que vos clients voient en scannant le QR code.</span>
          <label className="case"><input type="radio" name="page_accueil" value="menu" defaultChecked={pageAccueil !== 'carte'} />
            <span><b>Le menu, avec le sommelier</b><small>Le client choisit son plat, Pat lui propose des vins.</small></span></label>
          <label className="case"><input type="radio" name="page_accueil" value="carte" defaultChecked={pageAccueil === 'carte'} />
            <span><b>La carte des vins</b><small>Le menu et le sommelier restent accessibles par le bouton « Sommelier ».</small></span></label>
        </section>
        {impression}
        <div className="ligne-actions"><button type="submit" className="btn">Enregistrer l’apparence</button></div>
      </div>
      <aside className="etroit" style={{ alignItems: 'center' }}>
        <span className="surtitre">Aperçu de votre app</span>
        <ApercuApp mise={mise} couleur={couleur} texte={texte} logo={logoAffiche} nom={nom} a1={a1} a2={a2} plats={plats} />
      </aside>
    </FormulaireAdmin>
  );
}

type MiseEnPage = 'creme' | 'classique' | 'sombre';
const MISES_EN_PAGE: [MiseEnPage, string, string][] = [
  ['creme', 'Crème et courbes', 'Formes arrondies, fond clair à votre couleur (par défaut).'],
  ['classique', 'Classique', 'Lignes droites et cadres fins, sur fond blanc.'],
  ['sombre', 'Sombre', 'Fond sombre, idéal pour une salle peu éclairée le soir.'],
];

/** Aperçu de l'app des clients (téléphone), dans la mise en page choisie, avec la couleur, le logo et le message du restaurant. */
function ApercuApp({ mise, couleur, texte, logo, nom, a1, a2, plats }: { mise: MiseEnPage; couleur: string; texte: string; logo: string | null; nom: string; a1: string; a2: string; plats: string[] }) {
  const clair = texte !== '#FFFFFF';
  const accent = clair ? '#1A1A1A' : couleur;
  const melange = (k: number) => { const n = parseInt(accent.slice(1), 16); const c = (v: number) => Math.round(v * k + 255 * (1 - k)).toString(16).padStart(2, '0'); return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`; };
  const sombre = mise === 'sombre';
  const fond = sombre ? '#1C1A19' : mise === 'creme' ? melange(0.07) : '#FFFFFF';
  const surface = sombre ? '#2A2725' : '#FFFFFF';
  const encre = sombre ? '#F5EFE8' : '#1A1A1A';
  const ligne = sombre ? '#3D3835' : melange(0.2);
  const pastille = sombre ? '#332F2C' : melange(0.1);
  const titre = 'Outfit, Lato, sans-serif';
  const logoImg = logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={logo} alt="" style={{ maxWidth: 120, maxHeight: 56 }} /> : <b style={{ fontSize: 22 }}>{nom}</b>;
  const telephone: React.CSSProperties = { width: 340, maxWidth: '100%', height: 640, boxSizing: 'border-box', border: '10px solid #241F20', borderRadius: 42, overflow: 'hidden', background: fond, display: 'flex', flexDirection: 'column', fontFamily: 'Lato, sans-serif', color: encre };
  if (mise === 'classique') {
    return (
      <div className="apercu-app" style={telephone}>
        <div style={{ background: couleur, color: texte, padding: '14px 16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {logoImg}
            <span style={{ marginLeft: 'auto', height: 28, padding: '0 8px', border: `1px solid ${texte}`, display: 'flex', alignItems: 'center', fontSize: 9, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase' }}>Carte des vins</span>
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.25 }}>{a1}<br /><span style={{ fontWeight: 400, fontSize: 15 }}>{a2}</span></span>
            <span style={{ width: 40, height: 1, background: texte }} />
            <span style={{ fontSize: 15, fontStyle: 'italic' }}>Qu’allez-vous manger ?</span>
          </div>
        </div>
        <div style={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', padding: '16px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 6px', border: '1px solid #DDD' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 12, letterSpacing: 2 }}>ENTRÉES</span><span style={{ width: 18, height: 1, background: couleur }} /></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 5 }}>
              {plats.slice(0, 9).map((p) => <span key={p} style={{ height: 26, padding: '0 6px', border: '1px solid #BDBDBD', display: 'flex', alignItems: 'center', fontSize: 10 }}>{p}</span>)}
            </div>
          </div>
        </div>
        <div style={{ padding: '10px 12px 12px', boxShadow: '0 -6px 18px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 4px 4px', borderRadius: 30, background: '#FFEEED', border: '1.5px solid #FF0D05' }}>
            <span style={{ width: 42, height: 42, borderRadius: 21, boxSizing: 'border-box', background: '#FF0D05', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}><span className="buste-pat" /></span>
            <span style={{ flexGrow: 1, fontSize: 14, fontWeight: 700, color: '#4A4A4A' }}>Demandez à Pat…</span>
          </div>
        </div>
      </div>
    );
  }
  // Crème et courbes, ou Sombre (la même mise en page sur fond sombre).
  return (
    <div className="apercu-app" style={telephone}>
      <div style={{ position: 'relative', overflow: 'hidden', background: couleur, color: texte, padding: '14px 16px 20px', borderRadius: '0 0 26px 26px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: clair ? `1px solid ${ligne}` : 0 }}>
        <span style={{ position: 'absolute', top: -70, right: -50, width: 170, height: 130, borderRadius: '62% 38% 55% 45% / 48% 60% 40% 52%', background: clair ? 'rgba(26,26,26,0.05)' : 'rgba(255,255,255,0.12)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoImg}
          <span style={{ marginLeft: 'auto', height: 30, padding: '0 12px', borderRadius: 999, background: clair ? accent : 'rgba(255,255,255,0.18)', color: clair ? '#FFFFFF' : texte, display: 'flex', alignItems: 'center', fontFamily: titre, fontSize: 11, fontWeight: 600 }}>Carte des vins</span>
        </div>
        <div style={{ position: 'relative', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: titre, fontSize: 21, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' }}>{a1}<br /><span style={{ fontFamily: 'Lato, sans-serif', fontWeight: 400, fontSize: 15, letterSpacing: 0 }}>{a2}</span></span>
          <span style={{ fontFamily: titre, fontSize: 15, fontWeight: 600 }}>Qu’allez-vous manger ?</span>
        </div>
      </div>
      <div style={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: surface, border: sombre ? `1px solid ${ligne}` : 0, boxShadow: sombre ? 'none' : '0 8px 20px -12px rgba(46,46,46,0.35)' }}>
          {['Entrées', 'Plats', 'Desserts'].map((x) => <span key={x} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontFamily: titre, fontWeight: 600, fontSize: 11 }}>{x}</span>)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 12px', borderRadius: 18, background: surface, border: `1px solid ${ligne}` }}>
          <span style={{ fontFamily: titre, fontWeight: 700, fontSize: 15 }}>Entrées</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {plats.slice(0, 8).map((p, i) => <span key={p} style={{ height: 26, padding: '0 10px', borderRadius: 999, border: `1px solid ${i === 1 ? accent : ligne}`, background: i === 1 ? accent : pastille, color: i === 1 ? '#FFFFFF' : encre, fontWeight: i === 1 ? 700 : 400, display: 'flex', alignItems: 'center', fontSize: 10 }}>{i === 1 ? '✓ ' : ''}{p}</span>)}
          </div>
        </div>
      </div>
      <div style={{ padding: '6px 12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4, borderRadius: 999, background: surface, border: sombre ? `1px solid ${ligne}` : 0, boxShadow: sombre ? 'none' : '0 12px 26px -14px rgba(46,46,46,0.45)' }}>
          <span style={{ width: 38, height: 38, borderRadius: 19, boxSizing: 'border-box', background: '#FF0D05', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}><span className="buste-pat" /></span>
          <span style={{ flexGrow: 1, fontFamily: titre, fontSize: 13, fontWeight: 500, color: sombre ? '#C9BFB5' : '#4A4A4A' }}>Demandez à Pat…</span>
        </div>
      </div>
    </div>
  );
}
