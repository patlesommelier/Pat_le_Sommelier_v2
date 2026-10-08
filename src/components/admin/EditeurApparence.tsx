'use client';
import { useMemo, useState } from 'react';
import { FormulaireAdmin, type Retour } from './FormulaireAdmin';

const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (h: string) => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const claire = (h: string) => { const [r, g, b] = rgb(h); return hex(r + (255 - r) * 0.93, g + (255 - g) * 0.93, b + (255 - b) * 0.93); };
const valide = (h: string) => /^#[0-9a-f]{6}$/i.test(h);

/** Couleurs dominantes d'une photo (calculées dans le navigateur, la photo n'est pas envoyée). */
async function couleursDePhoto(f: File): Promise<string[]> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const c = document.createElement('canvas');
    c.width = 80; c.height = Math.max(1, Math.round((80 * img.height) / img.width));
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const seaux = new Map<number, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const s = seaux.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      s.n++; s.r += r; s.g += g; s.b += b;
      seaux.set(k, s);
    }
    const tri = [...seaux.values()].sort((a, b) => b.n - a.n).map((s) => [s.r / s.n, s.g / s.n, s.b / s.n]);
    const choisies: number[][] = [];
    for (const c2 of tri) {
      if (choisies.every((x) => Math.hypot(x[0] - c2[0], x[1] - c2[1], x[2] - c2[2]) > 60)) choisies.push(c2);
      if (choisies.length === 6) break;
    }
    // Les couleurs les plus « franches » d'abord : elles font de meilleures couleurs d'app que les gris.
    const sat = (x: number[]) => Math.max(...x) - Math.min(...x);
    return choisies.sort((a, b) => sat(b) - sat(a)).map((x) => hex(x[0], x[1], x[2]));
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface Props {
  action: (f: FormData) => Promise<Retour>;
  nom: string; couleur: string; logo: string | null; logoFonce: string | null; logoChoix: string | null; accroche: string | null;
  plats: string[];
}

export function EditeurApparence({ action, nom, couleur: initiale, logo, logoFonce, logoChoix, accroche, plats }: Props) {
  const [couleur, setCouleur] = useState(initiale.toUpperCase());
  const [saisie, setSaisie] = useState(initiale.toUpperCase());
  const [palette, setPalette] = useState<string[]>([]);
  const [lecture, setLecture] = useState(false);
  const [apercuLogo, setApercuLogo] = useState<string | null>(logo);
  const [apercuLogoFonce, setApercuLogoFonce] = useState<string | null>(logoFonce);
  // Logo affiché dans l'app : choisi ici ; sans choix enregistré, celui que l'app prenait automatiquement.
  const [choix, setChoix] = useState<'clair' | 'fonce'>(() => {
    const prefereFonce = logoChoix ? logoChoix === 'fonce' : 1.05 / (lum(initiale) + 0.05) < 3;
    return prefereFonce ? (logoFonce || !logo ? 'fonce' : 'clair') : (logo || !logoFonce ? 'clair' : 'fonce');
  });
  const [l1, l2] = (accroche ?? `Bienvenue chez ${nom},|nous vous aidons à choisir votre vin`).split('|');
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
        <section className="carte-bo pile">
          <div><h2>Couleur de l’app</h2><p className="sous">Déposez une photo de votre salle ou de votre devanture : Pat en tire les couleurs dominantes. Vous pouvez aussi saisir votre couleur.</p></div>
          <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', alignItems: 'start' }}>
            <div className="champ">
              <label htmlFor="photo">Photo de votre salle</label>
              <input id="photo" type="file" accept="image/*" style={{ padding: 8 }} onChange={async (e) => {
                const f = e.currentTarget.files?.[0];
                if (!f) return;
                setLecture(true);
                try { const p = await couleursDePhoto(f); setPalette(p); if (p[0]) choisir(p[0]); } finally { setLecture(false); }
              }} />
              <span className="aide">La photo reste sur votre appareil : seule la couleur choisie est enregistrée.</span>
            </div>
            <div className="pile" style={{ gap: 12 }}>
              {lecture && <span className="discret">Pat regarde la photo…</span>}
              {palette.length > 0 && (
                <div className="pile" style={{ gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Couleurs trouvées sur la photo</span>
                  <div role="group" aria-label="Couleurs proposées" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {palette.map((p) => (
                      <button key={p} type="button" aria-label={`Couleur ${p}`} aria-pressed={p === couleur} onClick={() => choisir(p)}
                        style={{ width: 56, height: 56, borderRadius: 14, background: p, cursor: 'pointer', border: p === couleur ? '3px solid #24151A' : '1px solid #D9CFD1', boxShadow: p === couleur ? 'inset 0 0 0 3px #FFF' : 'none' }} />
                    ))}
                  </div>
                </div>
              )}
              <div className="champ"><label htmlFor="hex">Ou votre couleur (code)</label>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input id="hex" value={saisie} onChange={(e) => { const v = e.target.value.toUpperCase(); setSaisie(v); if (valide(v)) setCouleur(v); }} style={{ width: 130, fontFamily: 'monospace' }} />
                  <input type="color" aria-label="Choisir une couleur" value={couleur.toLowerCase()} onChange={(e) => choisir(e.target.value.toUpperCase())} style={{ width: 48, height: 44, padding: 2, border: '1.5px solid var(--ligne)', borderRadius: 10, background: '#FFF' }} />
                </span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--ligne)', paddingTop: 14, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ width: 28, height: 28, borderRadius: 8, background: couleur, border: '1px solid #D9CFD1' }} /><span><span className="discret" style={{ fontSize: 13 }}>Couleur principale</span><br /><b style={{ fontFamily: 'monospace' }}>{couleur}</b></span></span>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ width: 28, height: 28, borderRadius: 8, background: claire(couleur), border: '1px solid #D9CFD1' }} /><span><span className="discret" style={{ fontSize: 13 }}>Couleur claire (barre de Pat), calculée</span><br /><b style={{ fontFamily: 'monospace' }}>{claire(couleur)}</b></span></span>
          </div>
          {contraste >= 4.5 && <span style={{ color: 'var(--vert)', fontSize: 14 }}>Texte blanc bien lisible sur cette couleur (contraste {contraste.toFixed(1).replace('.', ',')} : 1).</span>}
          {contraste >= 3 && contraste < 4.5 && <span style={{ color: 'var(--ocre)', fontSize: 14 }}><b>Lisibilité limitée</b> (contraste {contraste.toFixed(1).replace('.', ',')} : 1) : les petits textes blancs fatiguent. Une teinte un peu plus foncée serait plus confortable.</span>}
          {fondClair && <span style={{ color: '#8A1C1C', fontSize: 14 }}><b>Couleur claire</b> (contraste {contraste.toFixed(1).replace('.', ',')} : 1) : l’app écrit en foncé ; choisissez plutôt votre logo foncé.</span>}
        </section>
        <section className="carte-bo pile">
          <div><h2>Logo</h2><p className="sous">Vous pouvez déposer deux versions de votre logo (PNG ou SVG à fond transparent), puis choisir celle qui s’affiche en haut de l’app. Elles sont montrées ici sur la couleur de votre app.</p></div>
          <div role="radiogroup" aria-label="Logo affiché dans l’app" className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))' }}>
            {([
              ['clair', 'Logo clair', 'Blanc ou de couleur claire : pour une couleur d’app foncée.', apercuLogo, setApercuLogo, 'logo'],
              ['fonce', 'Logo foncé', 'Noir ou de couleur foncée : pour une couleur d’app claire.', apercuLogoFonce, setApercuLogoFonce, 'logo_fonce'],
            ] as const).map(([cle, titre, aide, apercu, setApercu, champ]) => {
              const choisi = choix === cle;
              return (
                <div key={cle} className="pile" style={{ gap: 10, padding: 14, borderRadius: 14, border: choisi ? '2.5px solid var(--encre)' : '1.5px solid var(--ligne)' }}>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: apercu ? 'pointer' : 'default' }}>
                    <input type="radio" name="choix_logo" checked={choisi} disabled={!apercu} onChange={() => setChoix(cle)} style={{ width: 20, height: 20, marginTop: 2 }} />
                    <span><b>{titre}</b>{choisi && apercu ? <span style={{ color: 'var(--vert)', fontWeight: 700 }}> · affiché dans l’app</span> : null}<br /><span className="aide">{aide}</span></span>
                  </label>
                  <span style={{ height: 96, borderRadius: 12, background: couleur, border: '1px solid var(--ligne)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {apercu ? <img src={apercu} alt={`${titre} actuel`} style={{ maxWidth: 160, maxHeight: 72 }} /> : <span style={{ color: texte, opacity: 0.8 }}>Aucun logo</span>}
                  </span>
                  <label htmlFor={champ} className="aide" style={{ fontWeight: 700 }}>{apercu ? 'Remplacer' : 'Déposer'} le {titre.toLowerCase()}</label>
                  <input id={champ} name={champ} type="file" accept="image/png,image/svg+xml,image/webp" style={{ padding: 8 }}
                    onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) { setApercu(URL.createObjectURL(f)); setChoix(cle); } }} />
                </div>
              );
            })}
          </div>
        </section>
        <section className="carte-bo pile">
          <h2>Message d’accueil</h2>
          <div className="champ"><label htmlFor="accroche1">Première ligne</label><input id="accroche1" name="accroche1" value={a1} onChange={(e) => setA1(e.target.value)} maxLength={40} /></div>
          <div className="champ"><label htmlFor="accroche2">Deuxième ligne</label><input id="accroche2" name="accroche2" value={a2} onChange={(e) => setA2(e.target.value)} maxLength={60} /></div>
        </section>
        <div className="ligne-actions"><button type="submit" className="btn">Enregistrer l’apparence</button></div>
      </div>
      <aside className="etroit" style={{ alignItems: 'center' }}>
        <span className="surtitre">Aperçu de votre app</span>
        <div style={{ width: 340, maxWidth: '100%', height: 640, boxSizing: 'border-box', border: '10px solid #24151A', borderRadius: 42, overflow: 'hidden', background: '#FFF', display: 'flex', flexDirection: 'column', fontFamily: 'Lato, sans-serif', color: '#1A1A1A' }}>
          <div style={{ background: couleur, color: texte, padding: '14px 16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoAffiche ? <img src={logoAffiche} alt="" style={{ maxWidth: 120, maxHeight: 56 }} /> : <b style={{ fontSize: 22 }}>{nom}</b>}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 4px 4px', borderRadius: 30, background: claire(couleur), border: `1.5px solid ${couleur}` }}>
              <span style={{ width: 42, height: 42, borderRadius: 21, border: `2px solid ${couleur}`, boxSizing: 'border-box', background: '#FFF', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/pat/pat.png" alt="" width={32} height={35} /></span>
              <span style={{ flexGrow: 1, fontSize: 14, fontWeight: 700, color: '#4A4A4A' }}>Demandez à Pat…</span>
            </div>
          </div>
        </div>
      </aside>
    </FormulaireAdmin>
  );
}
