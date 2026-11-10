'use client';
// Centre d'impression : logo des impressions, couleur des impressions, menu et suggestions à imprimer, puis la carte des vins :
// son design (six au choix, « Classique » par défaut) avec l'aperçu de la carte, et le bouton pour l'imprimer.
import { useState, type ReactNode } from 'react';
import { BoutonCarteImprimee } from './BoutonCarteImprimee';
import { FormulaireAdmin, type Retour } from './FormulaireAdmin';
import { DESIGNS_CARTE, type DesignCarte } from '@/lib/carte-imprimable';

export function CentreImpression({ action, resto, logoApp, logoImpression, design: initial, couleur, fond, noirEtBlanc: nbInitial }: {
  action: (f: FormData) => Promise<Retour>; resto: string; logoApp: string | null; logoImpression: string | null; design: DesignCarte; couleur: ReactNode;
  /** Couleur du bandeau de la couverture imprimée, sur laquelle le logo est aussi montré. */
  fond: string;
  /** Impressions en noir et blanc (carte, menu, suggestions). */
  noirEtBlanc: boolean;
}) {
  const [nb, setNb] = useState(nbInitial);
  const [design, setDesign] = useState<DesignCarte>(initial);
  const [apercuLogo, setApercuLogo] = useState<string | null>(logoImpression);
  const [retirer, setRetirer] = useState(false);
  const logo = retirer ? logoApp : apercuLogo ?? logoApp;
  const propre = Boolean(apercuLogo) && !retirer;
  return (
    <FormulaireAdmin action={action} className="pile" style={{ gap: 24 }}>
      {/* 1. Logo des impressions : celui de l'app par défaut, ou un autre (version pour le papier blanc, par exemple). */}
      <section className="carte-bo pile">
        <h2>Logo des impressions</h2>
        {/* Sur le blanc du papier, et sur la couleur du bandeau de la couverture. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {[['#FFFFFF', 'Sur le papier blanc'], [fond, 'Sur le bandeau de la couverture']].map(([f, legende]) => (
            <span key={legende} className="pile" style={{ gap: 6, flex: '1 1 220px', maxWidth: 320 }}>
              <span style={{ height: 120, borderRadius: 14, background: f, border: '1px solid var(--ligne)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo ? <img src={logo} alt="" style={{ maxWidth: 200, maxHeight: 90 }} /> : <span className="discret">Aucun logo</span>}
              </span>
              <small className="discret">{legende}</small>
            </span>
          ))}
        </div>
        <span className="discret" style={{ fontSize: 14 }}>{propre ? 'Logo propre aux impressions.' : 'Le même logo que l’app.'}</span>
        <div className="champ" style={{ maxWidth: 420 }}>
          <label htmlFor="logo_impression">{propre ? 'Remplacer le logo des impressions' : 'Utiliser un autre logo pour les impressions'}</label>
          <input id="logo_impression" name="logo_impression" type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" style={{ padding: 8 }}
            onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) { setApercuLogo(URL.createObjectURL(f)); setRetirer(false); } }} />
        </div>
        {propre && (
          <span><button type="button" className="btn fantome petit" onClick={() => setRetirer(true)}>Reprendre le logo de l’app</button></span>
        )}
        {retirer && <input type="hidden" name="logo_impression_retirer" value="1" />}
      </section>

      {/* 2. Couleur des impressions (titres et filets, sur le papier blanc), ou tout en noir et blanc. */}
      {couleur}
      <section className="carte-bo pile">
        <input type="hidden" name="impression_nb_envoye" value="1" />
        <label className="case" style={{ margin: 0 }}><input type="checkbox" name="impression_nb" value="1" defaultChecked={nb} onChange={(e) => setNb(e.currentTarget.checked)} />
          <span><b>Noir et blanc</b><small>Carte des vins, menu et suggestions imprimés sans couleur (pour une imprimante noir et blanc).</small></span></label>
      </section>

      {/* 3. Menu et suggestions. */}
      <section className="carte-bo pile">
        <h2>Menu et suggestions</h2>
        <div className="ligne-actions">
          <a href={`/admin/${resto}/menu/imprimer`} target="_blank" rel="noopener" className="btn rouge">Imprimer le menu</a>
          <a href={`/admin/${resto}/menu/imprimer?type=suggestions`} target="_blank" rel="noopener" className="btn rouge">Imprimer les suggestions</a>
        </div>
      </section>

      {/* 4. Carte des vins : le design (aperçu à droite), puis l'impression. */}
      <section className="carte-bo pile">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Carte des vins</h2>
          <BoutonCarteImprimee resto={resto} />
        </div>
        <div className="impression-carte">
          <div role="radiogroup" aria-label="Design de la carte des vins" className="pile" style={{ gap: 8, flex: '1 1 260px', minWidth: 0 }}>
            {DESIGNS_CARTE.map(([cle, titre, detail]) => (
              <label key={cle} className="design-carte" data-choisi={design === cle ? 'oui' : undefined}>
                <input type="radio" name="design_impression" value={cle} defaultChecked={design === cle} onChange={() => setDesign(cle)} />
                <span className="pile" style={{ gap: 2 }}><b>{titre}</b><small className="discret">{detail}</small></span>
              </label>
            ))}
            <span className="discret" style={{ fontSize: 13 }}>Enregistrez votre choix : il servira pour « Imprimer la carte ».</span>
          </div>
          <div className="apercu-carte" aria-label="Aperçu de la carte des vins">
            <iframe key={`${design}-${nb}`} title="Aperçu de la carte des vins" src={`/admin/${resto}/carte/imprimer?apercu=1&design=${design}&nb=${nb ? 1 : 0}`} loading="lazy" />
          </div>
        </div>
      </section>

      <div className="ligne-actions"><button type="submit" className="btn">Enregistrer</button></div>
    </FormulaireAdmin>
  );
}
