'use client';
// Carte des vins du restaurant, comme dans l'app : sous-catégories (titre modifiable) et leurs vins.
// - Une ligne de vin se prend à la souris et se dépose au-dessus d'un autre vin, ou sur un titre (en tête de cette sous-catégorie).
// - Un titre se prend à la souris (ou flèches ↑ ↓) : la sous-catégorie entière, avec ses vins, change de place.
// - « Nouvelle sous-catégorie » : ajoutée en bas ; elle est enregistrée dès qu'un vin y est déposé.
// Chaque changement est enregistré tout de suite. Les cellules des vins sont rendues par le serveur.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

export type LigneGlissable = { cle: string; ids: string[]; cellules: ReactNode; classe?: string; ancre?: string };
/** `entete` : titre fixe (catégorie spéciale) ; sinon titre modifiable. */
export type RubriqueGlissable = { cle: string; nom: string; entete?: ReactNode; vins: LigneGlissable[] };
type Plan = { rubrique: string; vins: string[][] }[];

let compteur = 0;

export function TableCarteGlissable({ rubriques: initiales, enregistrer, fixe = false }: { rubriques: RubriqueGlissable[]; enregistrer?: (plan: Plan) => Promise<{ ok: boolean }>; fixe?: boolean }) {
  const router = useRouter();
  const [rubriques, setRubriques] = useState(initiales);
  const [glisse, setGlisse] = useState<{ type: 'vin' | 'rubrique'; cle: string } | null>(null);
  const [cible, setCible] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  useEffect(() => setRubriques(initiales), [initiales]); // nouvelle version du serveur (après enregistrement)
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 2500); return () => clearTimeout(t); }, [message]);

  const sauver = (r: RubriqueGlissable[], texte = 'Enregistré : l’app est à jour.') => {
    setRubriques(r);
    if (fixe || !enregistrer) return;
    demarrer(async () => {
      // Les sous-catégories vides ne sont pas enregistrées (elles restent affichées ici jusqu'au rechargement).
      const res = await enregistrer(r.filter((x) => x.vins.length).map((x) => ({ rubrique: x.nom, vins: x.vins.map((v) => v.ids) })));
      setMessage(res.ok ? texte : 'Échec : rien n’a été enregistré.');
      router.refresh();
    });
  };
  const copie = () => rubriques.map((x) => ({ ...x, vins: [...x.vins] }));

  const deposerVin = (cle: string, rubrique: number, avant: string | null) => {
    if (cle === avant) return;
    const r = copie();
    let vin: LigneGlissable | undefined;
    for (const x of r) { const j = x.vins.findIndex((v) => v.cle === cle); if (j >= 0) [vin] = x.vins.splice(j, 1); }
    if (!vin) return;
    const j = avant ? r[rubrique].vins.findIndex((v) => v.cle === avant) : 0; // sur le titre : en tête de la sous-catégorie
    r[rubrique].vins.splice(j >= 0 ? j : r[rubrique].vins.length, 0, vin);
    sauver(r, 'Vin déplacé : l’app est à jour.');
  };
  const deplacerRubrique = (de: number, vers: number) => {
    if (de === vers || vers < 0 || vers >= rubriques.length) return;
    const r = copie();
    const [x] = r.splice(de, 1);
    r.splice(vers, 0, x);
    sauver(r, 'Sous-catégorie déplacée : l’app est à jour.');
  };
  const renommer = (i: number, nom: string) => {
    const propre = nom.replace(/\s+/g, ' ').trim();
    if (propre === rubriques[i].nom) return;
    const r = copie();
    r[i] = { ...r[i], nom: propre };
    if (r[i].vins.length) sauver(r, propre ? 'Sous-catégorie renommée.' : 'Titre retiré.'); else setRubriques(r);
  };
  const ajouter = () => setRubriques((r) => [...r, { cle: `n${Date.now()}-${compteur++}`, nom: 'Nouvelle sous-catégorie', vins: [] }]);

  const survol = (id: string) => (e: React.DragEvent) => { if (!glisse) return; e.preventDefault(); if (cible !== id) setCible(id); };
  const fin = () => { setGlisse(null); setCible(null); };
  const trait = (id: string) => (cible === id && glisse ? { boxShadow: 'inset 0 3px 0 var(--bordeaux, #6b0f24)' } : undefined);

  return (
    <>
      {rubriques.map((r, ri) => (
        <tbody key={r.cle} style={glisse?.type === 'rubrique' && glisse.cle === r.cle ? { opacity: 0.4 } : undefined}>
          <tr className="rubrique-carte" onDragOver={survol(`r:${r.cle}`)} onDragLeave={() => setCible(null)} style={trait(`r:${r.cle}`)}
            onDrop={(e) => {
              e.preventDefault();
              if (glisse?.type === 'vin') deposerVin(glisse.cle, ri, null);
              if (glisse?.type === 'rubrique') deplacerRubrique(rubriques.findIndex((x) => x.cle === glisse.cle), ri);
              fin();
            }}>
            {r.entete ?? (
              <td colSpan={8}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span draggable={!fixe} onDragStart={(e) => { setGlisse({ type: 'rubrique', cle: r.cle }); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={fin}
                    title="Glissez pour déplacer la sous-catégorie avec ses vins" aria-hidden="true" style={{ cursor: 'grab', color: '#B5ADA8', fontSize: 18, padding: '0 4px' }}>⋮⋮</span>
                  <input key={r.nom} defaultValue={r.nom} placeholder="Sans titre (aucune sous-catégorie affichée)" aria-label="Nom de la sous-catégorie" maxLength={80}
                    onBlur={(e) => renommer(ri, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                    style={{ flex: '1 1 240px', maxWidth: 420, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--bordeaux, #6b0f24)' }} />
                  <button type="button" className="btn fantome petit" disabled={ri === 0 || enCours} onClick={() => deplacerRubrique(ri, ri - 1)} aria-label="Monter la sous-catégorie">↑</button>
                  <button type="button" className="btn fantome petit" disabled={ri === rubriques.length - 1 || enCours} onClick={() => deplacerRubrique(ri, ri + 1)} aria-label="Descendre la sous-catégorie">↓</button>
                  <span className="petit discret">{r.vins.length ? `${r.vins.length} vin${r.vins.length > 1 ? 's' : ''}` : 'Vide : déposez-y un vin pour la créer'}</span>
                  {!r.vins.length && <button type="button" className="btn fantome petit" onClick={() => setRubriques((x) => x.filter((y) => y.cle !== r.cle))}>Retirer</button>}
                </div>
              </td>
            )}
          </tr>
          {r.vins.map((v) => (
            <tr key={v.cle} id={v.ancre} className={v.classe} draggable={!fixe}
              onDragStart={(e) => { e.stopPropagation(); setGlisse({ type: 'vin', cle: v.cle }); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={fin}
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
            </tr>
          ))}
        </tbody>
      ))}
      {!fixe && (
        <tbody><tr><td colSpan={8} style={{ border: 0, paddingTop: 12 }}>
          <button type="button" className="btn sec petit" onClick={ajouter}>+ Nouvelle sous-catégorie</button>
          <span className="petit discret" style={{ marginLeft: 10 }}>Elle s’ajoute en bas : nommez-la, puis glissez-y des vins.</span>
        </td></tr></tbody>
      )}
      {message && <tbody><tr><td colSpan={8} style={{ padding: 0, border: 0 }}><span role="status" className="toast-admin">{message}</span></td></tr></tbody>}
    </>
  );
}
