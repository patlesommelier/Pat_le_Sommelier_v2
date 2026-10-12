'use client';
// « Organiser la carte » : les rubriques et les vins d'une couleur, exactement comme dans l'app.
// Rubriques : renommer, ajouter, supprimer (vide), monter / descendre. Vins : glisser-déposer (ordinateur) ou flèches (téléphone),
// y compris d'une rubrique à l'autre. Rien n'est enregistré avant « Enregistrer ».
import { useState } from 'react';

export type VinOrga = { cle: string; ids: string[]; titre: string; sous: string; dispo: boolean; coeur: boolean };
export type RubriqueOrga = { cle: string; nom: string; vins: VinOrga[] };

let compteur = 0;
const nouvelleCle = () => `r${Date.now()}-${compteur++}`;

export function OrganisationCarte({ action, initiales }: { action: (f: FormData) => void | Promise<void>; initiales: RubriqueOrga[] }) {
  const [rubriques, setRubriques] = useState<RubriqueOrga[]>(initiales.length ? initiales : [{ cle: nouvelleCle(), nom: '', vins: [] }]);
  const [modifie, setModifie] = useState(false);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const changer = (f: (r: RubriqueOrga[]) => RubriqueOrga[]) => { setRubriques((r) => f(r.map((x) => ({ ...x, vins: [...x.vins] })))); setModifie(true); };

  // Position d'un vin : rubrique et rang.
  const ou = (r: RubriqueOrga[], cle: string) => {
    for (let i = 0; i < r.length; i++) { const j = r[i].vins.findIndex((v) => v.cle === cle); if (j >= 0) return [i, j] as const; }
    return null;
  };
  /** Un vin d'un cran vers le haut ou le bas ; au bord d'une rubrique, il passe dans la voisine. */
  const deplacer = (cle: string, sens: -1 | 1) => changer((r) => {
    const p = ou(r, cle); if (!p) return r;
    const [i, j] = p; const vins = r[i].vins;
    if (sens === -1) {
      if (j > 0) [vins[j - 1], vins[j]] = [vins[j], vins[j - 1]];
      else if (i > 0) r[i - 1].vins.push(...vins.splice(j, 1));
    } else if (j < vins.length - 1) [vins[j + 1], vins[j]] = [vins[j], vins[j + 1]];
    else if (i < r.length - 1) r[i + 1].vins.unshift(...vins.splice(j, 1));
    return r;
  });
  /** Glisser-déposer : le vin se place avant `avant` (ou à la fin de la rubrique `rubrique`). */
  const deposer = (cle: string, rubrique: number, avant: string | null) => changer((r) => {
    const p = ou(r, cle); if (!p || cle === avant) return r;
    const [vin] = r[p[0]].vins.splice(p[1], 1);
    const j = avant ? r[rubrique].vins.findIndex((v) => v.cle === avant) : -1;
    if (j >= 0) r[rubrique].vins.splice(j, 0, vin); else r[rubrique].vins.push(vin);
    return r;
  });
  const deplacerRubrique = (i: number, sens: -1 | 1) => changer((r) => {
    const k = i + sens; if (k < 0 || k >= r.length) return r;
    [r[i], r[k]] = [r[k], r[i]]; return r;
  });

  const plan = JSON.stringify(rubriques.map((r) => ({ rubrique: r.nom, vins: r.vins.map((v) => v.ids) })));
  const vides = rubriques.filter((r) => !r.vins.length).length;

  return (
    <form action={action} onSubmit={() => setEnvoi(true)} className="pile" style={{ gap: 14 }}>
      <input type="hidden" name="plan" value={plan} />
      {rubriques.map((r, i) => (
        <section key={r.cle} className="carte-bo pile" style={{ gap: 8, padding: '14px 16px' }}
          onDragOver={(e) => { if (glisse) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (glisse) deposer(glisse, i, null); setGlisse(null); }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={r.nom} placeholder={i === 0 ? 'Sans titre (en haut de la couleur)' : 'Nom de la rubrique'} aria-label="Nom de la rubrique" maxLength={80}
              onChange={(e) => { const v = e.target.value; changer((x) => { x[i].nom = v; return x; }); }}
              style={{ flex: '1 1 220px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }} />
            <button type="button" className="btn fantome petit" disabled={i === 0} onClick={() => deplacerRubrique(i, -1)} aria-label="Monter la rubrique">↑</button>
            <button type="button" className="btn fantome petit" disabled={i === rubriques.length - 1} onClick={() => deplacerRubrique(i, 1)} aria-label="Descendre la rubrique">↓</button>
            {!r.vins.length && rubriques.length > 1 && (
              <button type="button" className="btn fantome petit" onClick={() => changer((x) => x.filter((_, k) => k !== i))}>Supprimer</button>
            )}
          </div>
          {!r.nom.trim() && <span className="petit discret">Sans titre : ces vins s’affichent sans rubrique au-dessus.</span>}
          {r.vins.map((v, j) => (
            <div key={v.cle} draggable onDragStart={() => setGlisse(v.cle)} onDragEnd={() => setGlisse(null)}
              onDragOver={(e) => { if (glisse) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (glisse) deposer(glisse, i, v.cle); setGlisse(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--ligne, #E5E0DC)', borderRadius: 8,
                background: glisse === v.cle ? 'var(--fond-doux, #F7F3F1)' : '#FFF', opacity: v.dispo ? 1 : 0.55, cursor: 'grab' }}>
              <span aria-hidden="true" style={{ color: '#9A9A9A', fontSize: 18, lineHeight: 1 }}>⋮⋮</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{v.titre}</b>{v.coeur && <span style={{ marginLeft: 6, color: '#D7263D' }} aria-label="Coup de cœur">♥</span>}
                {v.sous && <div className="petit discret">{v.sous}</div>}
                {!v.dispo && <div className="petit discret">En rupture : pas affiché dans l’app</div>}
              </div>
              <button type="button" className="btn fantome petit" disabled={i === 0 && j === 0} onClick={() => deplacer(v.cle, -1)} aria-label="Monter le vin">↑</button>
              <button type="button" className="btn fantome petit" disabled={i === rubriques.length - 1 && j === r.vins.length - 1} onClick={() => deplacer(v.cle, 1)} aria-label="Descendre le vin">↓</button>
            </div>
          ))}
          {!r.vins.length && <span className="petit discret">Rubrique vide : glissez des vins ici, ou utilisez les flèches. Une rubrique vide n’est pas enregistrée.</span>}
        </section>
      ))}
      <div className="ligne-actions" style={{ position: 'sticky', bottom: 0, background: 'var(--fond, #FBF8F6)', padding: '10px 0' }}>
        <button type="button" className="btn sec" onClick={() => changer((r) => [...r, { cle: nouvelleCle(), nom: 'Nouvelle rubrique', vins: [] }])}>Ajouter une rubrique</button>
        <button type="button" className="btn fantome" disabled={!modifie || envoi} onClick={() => { setRubriques(initiales); setModifie(false); }}>Annuler</button>
        <button className="btn" disabled={!modifie || envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</button>
        {vides > 0 && <span className="petit discret">{vides} rubrique{vides > 1 ? 's' : ''} vide{vides > 1 ? 's' : ''}</span>}
      </div>
    </form>
  );
}
