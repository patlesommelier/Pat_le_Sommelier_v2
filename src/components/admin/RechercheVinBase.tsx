'use client';
// Ajout d'un vin, en haut de la page : le restaurant tape librement ce qu'il sait du vin (« M de Minuty rosé 2025 »),
// clique sur « Chercher », choisit parmi les vins trouvés dans la base de Pat ; les champs de la fiche se remplissent
// (couleur, région, intitulé, appellation, nom du vin, cépages, producteur, millésime). Tout reste modifiable.
import { useRef, useState } from 'react';
import type { VinTrouve } from '@/lib/admin/recherche-base';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blanc', rose: 'Rosé', rouge: 'Rouge', orange: 'Orange', doux: 'Doux', sans_alcool: 'Sans alcool' };
// Couleur dite dans le texte (comparée sans accents) : sert quand la base ne connaît pas celle du vin.
const MOTS_COULEUR: [RegExp, string][] = [[/\brouge\b/, 'rouge'], [/\bblanc\b/, 'blanc'], [/\brose\b/, 'rose'],
  [/\b(bulles|cremant|champagne|petillant|effervescent)\b/, 'bulles'], [/\borange\b/, 'orange'], [/\b(doux|moelleux|liquoreux)\b/, 'doux']];
const sansAccents = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Change la valeur d'un champ comme si on l'avait tapée (les champs pilotés par React, comme l'intitulé, suivent). */
function poser(form: HTMLFormElement | null, nom: string, valeur: string) {
  const el = form?.elements.namedItem(nom) as HTMLInputElement | HTMLSelectElement | null;
  if (!el) return;
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, valeur);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

const resume = (v: VinTrouve) => [v.producteur && !v.libelle.toLowerCase().includes(v.producteur.toLowerCase()) ? v.producteur : null,
  v.appellation && !v.libelle.toLowerCase().includes(v.appellation.toLowerCase()) ? v.appellation : null,
  v.couleur ? COULEURS[v.couleur] : null, v.cepages].filter(Boolean).join(' · ');

export function RechercheVinBase({ chercher }: { chercher: (texte: string) => Promise<VinTrouve[]> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [texte, setTexte] = useState('');
  const [trouves, setTrouves] = useState<VinTrouve[] | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [cherche, setCherche] = useState(false);
  const [erreur, setErreur] = useState(false);

  const lancer = async () => {
    const t = texte.trim();
    if (t.length < 3) return;
    setCherche(true); setErreur(false); setChoisi(null);
    try { setTrouves(await chercher(t)); } catch { setErreur(true); setTrouves(null); } finally { setCherche(false); }
  };

  const choisir = (v: VinTrouve) => {
    const form = ref.current?.form ?? null;
    const couleurTexte = MOTS_COULEUR.find(([re]) => re.test(sansAccents(texte)))?.[1];
    const millesime = texte.match(/\b(19|20)\d\d\b/)?.[0] ?? '';
    const couleur = v.couleur && COULEURS[v.couleur] ? v.couleur : couleurTexte;
    if (couleur) poser(form, 'couleur', couleur);
    poser(form, 'section', v.section ?? '');
    poser(form, 'appellation_texte', v.appellation ?? '');
    poser(form, 'nom_vin', v.nom_vin ?? '');
    poser(form, 'cepages', v.cepages ?? '');
    poser(form, 'producteur_texte', v.producteur ?? '');
    poser(form, 'libelle', v.libelle);
    if (millesime) poser(form, 'millesime', millesime);
    // L'étiquette de la base s'affiche dans le cadre « Photo de l'étiquette » ; elle sera reprise à l'ajout.
    window.dispatchEvent(new CustomEvent('pat:etiquette-base', { detail: v.etiquette }));
    setChoisi(v.cle);
  };

  return (
    <fieldset className="carte-bo pile" style={{ gap: 12, border: '1.5px solid var(--encre)', borderRadius: 14, padding: 16, margin: 0 }}>
      <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>Chercher le vin dans la base de Pat</legend>
      <div className="champ" style={{ margin: 0 }}>
        <label htmlFor="recherche_vin">Tout ce que vous savez du vin</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={ref} id="recherche_vin" value={texte} placeholder="Ex. M de Minuty rosé 2025" style={{ flex: '1 1 260px' }}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lancer(); } }} />
          <button type="button" className="btn" onClick={lancer} disabled={cherche || texte.trim().length < 3}>{cherche ? 'Pat cherche…' : 'Chercher'}</button>
        </div>
        <span className="aide">Nom, producteur, appellation, couleur, millésime… dans n’importe quel ordre.</span>
      </div>
      <input type="hidden" name="base_cle" value={choisi ?? ''} />
      <div role="status" aria-live="polite" className="pile" style={{ gap: 8 }}>
        {erreur && <span className="petit">La recherche n’a pas abouti. Réessayez, ou remplissez les champs ci-dessous.</span>}
        {trouves && !cherche && (trouves.length === 0
          ? <span className="petit">Ce vin n’est pas encore dans la base de Pat : remplissez les champs ci-dessous, il y sera ajouté.</span>
          : <>
            <span className="petit">{choisi ? 'Les champs ci-dessous sont remplis avec ce vin : vérifiez-les, et complétez les prix.'
              : trouves.length === 1 ? 'Pat a trouvé ce vin. Est-ce le bon ?' : `Pat a trouvé ${trouves.length} vins. Lequel est le vôtre ?`}</span>
            <div className="pile" style={{ gap: 6 }}>
              {trouves.map((v) => (
                <button key={v.cle} type="button" onClick={() => choisir(v)} aria-pressed={choisi === v.cle}
                  style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', font: 'inherit',
                    border: `1.5px solid ${choisi === v.cle ? 'var(--encre)' : 'var(--ligne)'}`,
                    background: choisi === v.cle ? 'var(--encre)' : 'transparent', color: choisi === v.cle ? '#EFEBE9' : 'var(--texte)' }}>
                  <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {v.etiquette ? <img src={v.etiquette} alt="" style={{ width: 40, height: 52, objectFit: 'contain', background: '#EFEBE9', borderRadius: 6, flexShrink: 0 }} /> : null}
                    <span>{choisi === v.cle ? '✓ ' : ''}<b>{v.libelle}</b>{resume(v) && <span style={{ display: 'block', fontSize: 13 }}>{resume(v)}</span>}</span>
                  </span>
                </button>
              ))}
            </div>
          </>)}
      </div>
    </fieldset>
  );
}
