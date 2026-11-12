'use client';
// Carte des vins du restaurant, comme dans l'app : sous-catégories (titre modifiable) et leurs vins.
// - Une ligne de vin se prend à la souris et se dépose au-dessus d'un autre vin, ou sur un titre (en tête de cette sous-catégorie).
// - Un titre se prend à la souris (ou flèches ↑ ↓) : la sous-catégorie entière, avec ses vins, change de place.
// - « Nouvelle sous-catégorie » : ajoutée en bas ; elle est enregistrée dès qu'un vin y est déposé.
// - Page Les vins : des catégories au-dessus des sous-catégories (au départ, les couleurs), renommables et déplaçables avec
//   tout ce qu'elles contiennent ; une catégorie porte aussi ses vins sans sous-catégorie.
// Chaque changement est enregistré tout de suite. Les cellules des vins sont rendues par le serveur.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

/** `cellules` : les 7 premières colonnes ; `fin` : le lien « Modifier » (la dernière colonne ajoute les flèches ↑ ↓). */
export type LigneGlissable = { cle: string; ids: string[]; cellules: ReactNode; fin?: ReactNode; libelle?: string; classe?: string; ancre?: string };
/** `entete` : titre fixe (catégorie spéciale) ; sinon titre modifiable. `categorie` : titre de catégorie (les sous-catégories qui suivent sont à elle). */
export type RubriqueGlissable = { cle: string; nom: string; entete?: ReactNode; vins: LigneGlissable[]; categorie?: boolean };
type Plan = { rubrique: string; categorie?: string; vins: string[][] }[];

let compteur = 0;

/**
 * `colonnes` : nombre de colonnes du tableau (8 sur la carte) ; `apres` : fin des messages d'enregistrement (« l’app est à jour » sur la carte).
 * Une ligne qui contient des champs (page Les vins) ne se prend pas à la souris depuis un champ, un bouton ou un lien : on peut y écrire normalement.
 */
export function TableCarteGlissable({ rubriques: initiales, enregistrer, fixe = false, colonnes = 8, apres = 'l’app est à jour' }: { rubriques: RubriqueGlissable[]; enregistrer?: (plan: Plan) => Promise<{ ok: boolean }>; fixe?: boolean; colonnes?: number; apres?: string }) {
  const router = useRouter();
  const [rubriques, setRubriques] = useState(initiales);
  const [glisse, setGlisse] = useState<{ type: 'vin' | 'rubrique'; cle: string } | null>(null);
  const [cible, setCible] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [dansChamp, setDansChamp] = useState(false); // souris enfoncée sur un champ, un bouton ou un lien : pas de glisser
  useEffect(() => setRubriques(initiales), [initiales]); // nouvelle version du serveur (après enregistrement)
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 2500); return () => clearTimeout(t); }, [message]);

  const sauver = (r: RubriqueGlissable[], quoi = 'Enregistré') => {
    const texte = `${quoi} : ${apres}.`;
    setRubriques(r);
    if (fixe || !enregistrer) return;
    demarrer(async () => {
      // Les sous-catégories vides ne sont pas enregistrées (elles restent affichées ici jusqu'au rechargement).
      let categorie = '';
      const plan: Plan = [];
      for (const x of r) {
        if (x.categorie) categorie = x.nom;
        if (x.vins.length) plan.push({ rubrique: x.categorie ? '' : x.nom, ...(avecCategories ? { categorie } : {}), vins: x.vins.map((v) => v.ids) });
      }
      const res = await enregistrer(plan);
      setMessage(res.ok ? texte : 'Échec : rien n’a été enregistré.');
      router.refresh();
    });
  };
  const copie = () => rubriques.map((x) => ({ ...x, vins: [...x.vins] }));
  const avecCategories = rubriques.some((x) => x.categorie);
  /** Fin (exclue) du bloc d'une catégorie : jusqu'à la catégorie suivante. */
  const finBloc = (r: RubriqueGlissable[], i: number) => { let j = i + 1; while (j < r.length && !r[j].categorie) j++; return j; };
  const debutsCategories = rubriques.map((x, i) => (x.categorie ? i : -1)).filter((i) => i >= 0);
  /** Catégorie déplacée d'un cran, avec ses sous-catégories et ses vins. */
  const deplacerCategorie = (i: number, sens: -1 | 1) => {
    const r = copie();
    const k = debutsCategories.indexOf(i);
    const voisine = debutsCategories[k + sens];
    if (voisine === undefined) return;
    const [a, b] = sens === -1 ? [voisine, i] : [i, voisine];
    const blocA = r.slice(a, finBloc(r, a)), blocB = r.slice(b, finBloc(r, b));
    r.splice(a, blocA.length + blocB.length, ...blocB, ...blocA);
    sauver(r, 'Catégorie déplacée');
  };
  const ajouterCategorie = () => { const cle = `c${Date.now()}-${compteur++}`; setRubriques((r) => [...r, { cle, nom: '', vins: [], categorie: true }]); setNouvelle(cle); };

  const deposerVin = (cle: string, rubrique: number, avant: string | null) => {
    if (cle === avant) return;
    const r = copie();
    let vin: LigneGlissable | undefined;
    for (const x of r) { const j = x.vins.findIndex((v) => v.cle === cle); if (j >= 0) [vin] = x.vins.splice(j, 1); }
    if (!vin) return;
    const j = avant ? r[rubrique].vins.findIndex((v) => v.cle === avant) : 0; // sur le titre : en tête de la sous-catégorie
    r[rubrique].vins.splice(j >= 0 ? j : r[rubrique].vins.length, 0, vin);
    sauver(r, 'Vin déplacé');
  };
  /** Flèches d'un vin : un cran ; au bord d'une sous-catégorie, il passe dans la voisine (même vide). */
  const flecheVin = (cle: string, sens: -1 | 1) => {
    const r = copie();
    const i = r.findIndex((x) => x.vins.some((v) => v.cle === cle));
    if (i < 0) return;
    const vins = r[i].vins; const j = vins.findIndex((v) => v.cle === cle);
    if (sens === -1) {
      if (j > 0) [vins[j - 1], vins[j]] = [vins[j], vins[j - 1]];
      else if (i > 0) r[i - 1].vins.push(...vins.splice(j, 1)); else return;
    } else if (j < vins.length - 1) [vins[j + 1], vins[j]] = [vins[j], vins[j + 1]];
    else if (i < r.length - 1) r[i + 1].vins.unshift(...vins.splice(j, 1)); else return;
    sauver(r, 'Vin déplacé');
  };
  const deplacerRubrique = (de: number, vers: number) => {
    if (de === vers || vers < 0 || vers >= rubriques.length) return;
    if (rubriques[de].categorie) { if (rubriques[vers].categorie) deplacerCategorie(de, vers < de ? -1 : 1); return; }
    if (vers === 0 && rubriques[0].categorie) return; // une sous-catégorie reste sous une catégorie
    const r = copie();
    const [x] = r.splice(de, 1);
    r.splice(vers, 0, x);
    sauver(r, 'Sous-catégorie déplacée');
  };
  const renommer = (i: number, nom: string) => {
    const propre = nom.replace(/\s+/g, ' ').trim();
    if (propre === rubriques[i].nom) return;
    if (rubriques[i].categorie && !propre) { setRubriques(copie()); return; } // une catégorie garde un nom
    const r = copie();
    r[i] = { ...r[i], nom: propre };
    const pleine = rubriques[i].categorie ? r.slice(i, finBloc(r, i)).some((x) => x.vins.length) : r[i].vins.length > 0;
    if (pleine) sauver(r, rubriques[i].categorie ? 'Catégorie renommée' : propre ? 'Sous-catégorie renommée' : 'Titre retiré'); else setRubriques(r);
  };
  const [nouvelle, setNouvelle] = useState<string | null>(null); // titre à remplir (curseur dedans)
  const ajouter = () => { const cle = `n${Date.now()}-${compteur++}`; setRubriques((r) => [...r, { cle, nom: '', vins: [] }]); setNouvelle(cle); };

  const survol = (id: string) => (e: React.DragEvent) => { if (!glisse) return; e.preventDefault(); if (cible !== id) setCible(id); };
  const fin = () => { setGlisse(null); setCible(null); };
  const trait = (id: string) => (cible === id && glisse ? { boxShadow: 'inset 0 3px 0 var(--encre)' } : undefined);

  return (
    <>
      {rubriques.map((r, ri) => (
        <tbody key={r.cle} style={glisse?.type === 'rubrique' && glisse.cle === r.cle ? { opacity: 0.4 } : undefined}>
          <tr className={r.categorie ? 'rubrique-carte categorie-cave' : 'rubrique-carte'} onDragOver={survol(`r:${r.cle}`)} onDragLeave={() => setCible(null)} style={trait(`r:${r.cle}`)}
            onDrop={(e) => {
              e.preventDefault();
              if (glisse?.type === 'vin') deposerVin(glisse.cle, ri, null);
              if (glisse?.type === 'rubrique') deplacerRubrique(rubriques.findIndex((x) => x.cle === glisse.cle), ri);
              fin();
            }}>
            {r.entete ?? (r.categorie ? (
              <td colSpan={colonnes} className="titre-categorie">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input key={r.nom} defaultValue={r.nom} autoFocus={nouvelle === r.cle} aria-label="Nom de la catégorie" maxLength={80}
                    placeholder="Nom de la nouvelle catégorie (ex. une région)"
                    onBlur={(e) => renommer(ri, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                    style={{ flex: '1 1 240px', maxWidth: 420, fontWeight: 800, fontSize: 17, color: 'var(--texte)' }} />
                  <button type="button" className="btn fantome petit" disabled={debutsCategories[0] === ri || enCours} onClick={() => deplacerCategorie(ri, -1)} aria-label="Monter la catégorie">↑</button>
                  <button type="button" className="btn fantome petit" disabled={debutsCategories[debutsCategories.length - 1] === ri || enCours} onClick={() => deplacerCategorie(ri, 1)} aria-label="Descendre la catégorie">↓</button>
                  {(() => { const n = rubriques.slice(ri, finBloc(rubriques, ri)).reduce((t, x) => t + x.vins.length, 0);
                    return <>
                      <span className="petit discret">{n ? `${n} vin${n > 1 ? 's' : ''}` : 'Vide : déposez-y un vin pour la créer'}</span>
                      {!n && finBloc(rubriques, ri) === ri + 1 && <button type="button" className="btn fantome petit" onClick={() => setRubriques((x) => x.filter((y) => y.cle !== r.cle))}>Retirer</button>}
                    </>; })()}
                </div>
              </td>
            ) : (
              <td colSpan={colonnes}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span draggable={!fixe} onDragStart={(e) => { setGlisse({ type: 'rubrique', cle: r.cle }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); }} onDragEnd={fin}
                    title="Glissez pour déplacer la sous-catégorie avec ses vins" aria-hidden="true" style={{ cursor: 'grab', color: '#C9BCB8', fontSize: 18, padding: '0 4px' }}>⋮⋮</span>
                  <input key={r.nom} defaultValue={r.nom} autoFocus={nouvelle === r.cle} aria-label="Nom de la sous-catégorie" maxLength={80}
                    placeholder={r.vins.length ? 'Sans titre (aucune sous-catégorie affichée)' : 'Nom de la nouvelle sous-catégorie'}
                    onBlur={(e) => renommer(ri, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                    style={{ flex: '1 1 240px', maxWidth: 420, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.8, color: 'var(--fuchsia)' }} />
                  <button type="button" className="btn fantome petit" disabled={ri === 0 || enCours} onClick={() => deplacerRubrique(ri, ri - 1)} aria-label="Monter la sous-catégorie">↑</button>
                  <button type="button" className="btn fantome petit" disabled={ri === rubriques.length - 1 || enCours} onClick={() => deplacerRubrique(ri, ri + 1)} aria-label="Descendre la sous-catégorie">↓</button>
                  <span className="petit discret">{r.vins.length ? `${r.vins.length} vin${r.vins.length > 1 ? 's' : ''}` : 'Vide : déposez-y un vin pour la créer'}</span>
                  {!r.vins.length && <button type="button" className="btn fantome petit" onClick={() => setRubriques((x) => x.filter((y) => y.cle !== r.cle))}>Retirer</button>}
                </div>
              </td>
            ))}
          </tr>
          {!r.vins.length && !fixe && !(r.categorie && finBloc(rubriques, ri) > ri + 1) && (
            <tr onDragOver={survol(`r:${r.cle}`)} onDrop={(e) => { e.preventDefault(); if (glisse?.type === 'vin') deposerVin(glisse.cle, ri, null); fin(); }}>
              <td colSpan={colonnes} style={{ padding: 18, textAlign: 'center', border: '2px dashed var(--ligne, #AFB0AE)', color: '#241F20', ...trait(`r:${r.cle}`) }}>
                Déposez un vin ici, ou utilisez les flèches ↓ d’un vin de la sous-catégorie du dessus.
              </td>
            </tr>
          )}
          {r.vins.map((v, vi) => (
            <tr key={v.cle} id={v.ancre} className={v.classe} draggable={!fixe && !dansChamp}
              onMouseDownCapture={(e) => setDansChamp(Boolean((e.target as HTMLElement).closest('input, select, textarea, button')))}
              onMouseUp={() => setDansChamp(false)}
              onDragStart={(e) => { e.stopPropagation(); setGlisse({ type: 'vin', cle: v.cle }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); }} onDragEnd={fin}
              onDragOver={survol(v.cle)}
              onDrop={(e) => {
                e.preventDefault();
                if (glisse?.type === 'vin') deposerVin(glisse.cle, ri, v.cle);
                if (glisse?.type === 'rubrique') deplacerRubrique(rubriques.findIndex((x) => x.cle === glisse.cle), ri);
                fin();
              }}
              style={{ scrollMarginTop: 80, cursor: fixe ? undefined : 'grab', opacity: glisse?.cle === v.cle ? 0.4 : enCours ? 0.8 : 1, ...trait(v.cle) }}
              title={fixe ? undefined : 'Glissez la ligne pour déplacer ce vin'}>
              {v.cellules}
              <td className="droite" style={{ whiteSpace: 'nowrap' }}>
                {!fixe && (
                  <div style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', marginRight: 8 }}>
                    <button type="button" className="btn fantome petit" disabled={enCours || (ri === 0 && vi === 0)} onClick={() => flecheVin(v.cle, -1)}
                      aria-label={`Monter ${v.libelle ?? ''}`} title={vi === 0 ? 'Passer dans la sous-catégorie du dessus' : 'Monter'}>↑</button>
                    <button type="button" className="btn fantome petit" disabled={enCours || (ri === rubriques.length - 1 && vi === r.vins.length - 1)} onClick={() => flecheVin(v.cle, 1)}
                      aria-label={`Descendre ${v.libelle ?? ''}`} title={vi === r.vins.length - 1 ? 'Passer dans la sous-catégorie du dessous' : 'Descendre'}>↓</button>
                  </div>
                )}
                {v.fin}
              </td>
            </tr>
          ))}
        </tbody>
      ))}
      {!fixe && (
        <tbody><tr><td colSpan={colonnes} style={{ border: 0, paddingTop: 12 }}>
          {/* Ma cave (catégories) : « + Nouvelle catégorie » seulement ; la carte des vins : « + Ajouter un titre ». */}
          {avecCategories
            ? <button type="button" className="btn sec petit" onClick={ajouterCategorie}>+ Nouvelle catégorie</button>
            : <button type="button" className="btn sec petit" onClick={ajouter}>+ Ajouter un titre (ex. Bourgogne)</button>}
          <span className="petit discret" style={{ marginLeft: 10 }}>{avecCategories ? 'Elle s’ajoute tout en bas : nommez-la, puis glissez-y des vins (ou flèche ↓ sur le dernier vin du dessus).' : 'Elle s’ajoute en bas : nommez-la, puis glissez-y des vins (ou flèche ↓ sur le dernier vin du dessus).'}</span>
        </td></tr></tbody>
      )}
      {message && <tbody><tr><td colSpan={colonnes} style={{ padding: 0, border: 0 }}><span role="status" className="toast-admin">{message}</span></td></tr></tbody>}
    </>
  );
}
