'use client';
// Choix de la couleur avec aperçu en direct de l'app client.
import { useState } from 'react';
import s from '../inscription.module.css';
import { FormulaireAction } from '../composants';
import { choisirCouleur } from '../actions';

type Proposition = { hex: string; nom: string; duLogo: boolean };

export function ChoixCouleur({ propositions, initiale, logo, nom, plats }: {
  propositions: Proposition[]; initiale: string; logo: string | null; nom: string; plats: string[];
}) {
  const [couleur, setCouleur] = useState(initiale);
  const valide = /^#[0-9a-f]{6}$/i.test(couleur);
  return (
    <FormulaireAction action={choisirCouleur} libelle="Continuer" enCours="Enregistrement…">
      <div role="img" aria-label="Aperçu de l’app client avec cette couleur" className={s.telephone}>
        <div style={{ height: 80, background: valide ? couleur : '#610420', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" style={{ maxWidth: 110, maxHeight: 50 }} /> : <strong style={{ color: '#FFF' }}>{nom}</strong>}
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13 }}>Bienvenue{nom ? ` chez ${nom}` : ''}. Qu’allez-vous manger ?</span>
          {plats.map((p) => (
            <span key={p} style={{ padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${valide ? couleur : '#610420'}`,
              fontSize: 12, fontWeight: 700, color: valide ? couleur : '#610420' }}>{p}</span>
          ))}
        </div>
      </div>
      <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Couleurs proposées</legend>
        <div className={s.nuancier}>
          {propositions.map((p) => (
            <label key={p.hex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input className={s.cacher} type="radio" name="choix" value={p.hex} checked={couleur.toUpperCase() === p.hex}
                onChange={() => setCouleur(p.hex)} />
              <span className={s.pastilleCouleur} style={{ background: p.hex,
                boxShadow: couleur.toUpperCase() === p.hex ? '0 0 0 3px #FFF, 0 0 0 5px #610420' : 'none' }} />
              <span style={{ fontSize: 12.5, color: '#66565B' }}>{p.nom}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={s.champ}>
        <label htmlFor="couleur">Ou votre code couleur</label>
        <input id="couleur" name="couleur" value={couleur} onChange={(e) => setCouleur(e.target.value)} spellCheck={false} />
      </div>
    </FormulaireAction>
  );
}
