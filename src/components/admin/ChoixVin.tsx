'use client';
// Ajout d'un vin (fenêtre de la Base de vins) : le restaurant cherche le vin (base de Pat et catalogues des distributeurs
// de Quid Vinum), ou parcourt le catalogue d'un distributeur, ou le décrit lui-même. Le vin choisi remplit la fiche
// (tout reste modifiable) ; s'il est vendu par un distributeur, la commande est proposée (champ « distributeur_vin »).
import { useRef, useState } from 'react';
import type { VinTrouve } from '@/lib/admin/recherche-base';
import { PatAttente } from '@/components/PatAttente';

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

/** Remplit la fiche du vin avec un vin trouvé (base de Pat ou catalogue d'un distributeur) ; tout reste modifiable. */
function remplirFiche(form: HTMLFormElement | null, v: VinTrouve, texte = '') {
  // Couleur inconnue de la base : celle dite dans le texte tapé, sinon dans le nom du vin (« Pinot Blanc »).
  const couleurTexte = MOTS_COULEUR.find(([re]) => re.test(sansAccents(texte)))?.[1] ?? MOTS_COULEUR.find(([re]) => re.test(sansAccents(v.libelle)))?.[1];
  const millesime = v.millesime ?? texte.match(/\b(19|20)\d\d\b/)?.[0] ?? '';
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
}

const euros = (n: number | null) => (n == null ? '—' : `${n.toFixed(2).replace('.', ',')} €`);

/** Offres des distributeurs d'un vin choisi : commander chez l'un d'eux (ou non). Champ « distributeur_vin ». */
function OffresVin({ offres, valeur, changer }: { offres: NonNullable<VinTrouve['offres']>; valeur: string; changer: (id: string) => void }) {
  return (
    <div className="pile" style={{ gap: 6, border: '1.5px solid var(--rouge, #C8102E)', borderRadius: 12, padding: '10px 14px' }}>
      <b className="petit">Ce vin est disponible chez {offres.length > 1 ? 'des distributeurs' : 'un distributeur'} de Quid Vinum : voulez-vous le commander ?</b>
      {offres.map((o) => (
        <label key={o.id} className="case" style={{ margin: 0, opacity: o.epuise ? 0.55 : 1 }}>
          <input type="radio" name="choix_offre" checked={valeur === o.id} disabled={o.epuise} onChange={() => changer(o.id)} />
          <span>Chez <b>{o.distributeur}</b> · {o.libelle}{o.millesime ? ` ${o.millesime}` : ''}{o.contenance ? ` · ${o.contenance}` : ''} · <b>{euros(o.prix)} HTVA</b>{o.epuise ? ' · épuisé' : ''}</span>
        </label>
      ))}
      <label className="case" style={{ margin: 0 }}><input type="radio" name="choix_offre" checked={valeur === ''} onChange={() => changer('')} /><span>Non, je l’ai déjà ou je l’achète ailleurs</span></label>
      <span className="aide">Le distributeur est ajouté à vos fournisseurs ; après l’ajout du vin, vous pourrez passer la commande.</span>
    </div>
  );
}

const resume = (v: VinTrouve) => [v.producteur && !v.libelle.toLowerCase().includes(v.producteur.toLowerCase()) ? v.producteur : null,
  v.appellation && !v.libelle.toLowerCase().includes(v.appellation.toLowerCase()) ? v.appellation : null,
  v.couleur ? COULEURS[v.couleur] : null, v.cepages].filter(Boolean).join(' · ');

const MAX = 60;

export function ChoixVin({ chercher, distributeurs, charger }: {
  chercher: (texte: string) => Promise<VinTrouve[]>;
  distributeurs: { id: string; nom: string; vins: number }[];
  charger: (distributeurId: string) => Promise<VinTrouve[]>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [texte, setTexte] = useState('');
  const [trouves, setTrouves] = useState<VinTrouve[] | null>(null);
  const [catalogue, setCatalogue] = useState<VinTrouve[] | null>(null);
  const [filtre, setFiltre] = useState('');
  const [distributeur, setDistributeur] = useState('');
  const [choisi, setChoisi] = useState<VinTrouve | null>(null);
  const [libre, setLibre] = useState(false);
  const [offre, setOffre] = useState('');
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState(false);

  const form = () => ref.current?.closest('form') ?? null;
  const description = (ouverte: boolean) => { const d = form()?.querySelector<HTMLDetailsElement>('#description-vin'); if (d) d.open = ouverte; };

  const lancer = async () => {
    const t = texte.trim();
    if (t.length < 3) return;
    setAttente(true); setErreur(false); setCatalogue(null); setDistributeur('');
    try { setTrouves(await chercher(t)); } catch { setErreur(true); setTrouves(null); } finally { setAttente(false); }
  };
  const parcourir = async (id: string) => {
    setDistributeur(id); setCatalogue(null); setFiltre(''); setTrouves(null); setErreur(false);
    if (!id) return;
    setAttente(true);
    try { setCatalogue(await charger(id)); } catch { setErreur(true); } finally { setAttente(false); }
  };
  // Offre choisie : son millésime remplit la fiche (celui du vin commandé).
  const prendreOffre = (v: VinTrouve | null, id: string) => {
    setOffre(id);
    const m = v?.offres?.find((o) => o.id === id)?.millesime;
    if (m) poser(form(), 'millesime', m);
  };
  const choisir = (v: VinTrouve) => {
    remplirFiche(form(), v, texte);
    setChoisi(v); setLibre(false);
    prendreOffre(v, v.offres?.find((o) => !o.epuise)?.id ?? '');
    description(false);
  };
  const recommencer = () => { setChoisi(null); setLibre(false); setOffre(''); };
  const decrire = () => { setChoisi(null); setLibre(true); setOffre(''); description(true); };

  const mots = sansAccents(filtre).split(/\s+/).filter(Boolean);
  const visibles = (catalogue ?? []).filter((v) => {
    const t = sansAccents([v.libelle, v.producteur, v.appellation, v.section, v.millesime, ...(v.offres ?? []).map((o) => o.libelle)].filter(Boolean).join(' '));
    return mots.every((m) => t.includes(m));
  });

  const ligne = (v: VinTrouve, k: string) => {
    const o = catalogue ? v.offres?.[0] : undefined; // catalogue d'un distributeur : une ligne par vin, avec son prix
    const prix = v.offres?.filter((x) => x.prix != null).map((x) => x.prix!) ?? [];
    return (
      <button key={k} type="button" onClick={() => choisir(v)} className="choix-vin">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {v.etiquette ? <img src={v.etiquette} alt="" /> : <span className="sans-image" />}
        <span style={{ flex: 1 }}><b>{o?.libelle ?? v.libelle}</b>{(o?.millesime ?? v.millesime) ? ` ${o?.millesime ?? v.millesime}` : ''}
          {resume(v) && <span className="petit" style={{ display: 'block' }}>{resume(v)}</span>}
          {!o && v.offres?.length ? <span className="petit" style={{ display: 'block', fontWeight: 700 }}>Chez {[...new Set(v.offres.map((x) => x.distributeur))].join(', ')}{prix.length ? ` · dès ${euros(Math.min(...prix))} HTVA` : ''}</span> : null}</span>
        {o && <b style={{ whiteSpace: 'nowrap' }}>{euros(o.prix)} HTVA{o.epuise ? ' · épuisé' : ''}</b>}
      </button>
    );
  };

  return (
    <div ref={ref} className="pile" style={{ gap: 12 }}>
      <input type="hidden" name="base_cle" value={choisi && !choisi.cle.startsWith('distrib:') ? choisi.cle : ''} />
      <input type="hidden" name="distributeur_vin" value={offre} />
      {choisi ? (
        <div className="pile" style={{ gap: 10 }}>
          <div className="choix-vin choisi">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {choisi.etiquette ? <img src={choisi.etiquette} alt="" /> : <span className="sans-image" />}
            <span style={{ flex: 1 }}>✓ <b>{choisi.libelle}</b>{resume(choisi) && <span className="petit" style={{ display: 'block' }}>{resume(choisi)}</span>}</span>
            <button type="button" className="btn fantome petit" onClick={recommencer}>Changer</button>
          </div>
          {choisi.offres?.length ? <OffresVin offres={choisi.offres} valeur={offre} changer={(id) => prendreOffre(choisi, id)} /> : null}
        </div>
      ) : libre ? (
        <p className="petit" style={{ margin: 0 }}>Décrivez le vin ci-dessous : Quid Vinum l’ajoutera à ses vins connus. <button type="button" className="btn fantome petit" onClick={recommencer}>Revenir à la recherche</button></p>
      ) : (
        <>
          <div className="champ" style={{ margin: 0 }}>
            <label htmlFor="recherche_vin">Quel vin ?</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input id="recherche_vin" value={texte} placeholder="Ex. Nero d’Avola Molino a Vento" style={{ flex: '1 1 260px' }} autoFocus
                onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lancer(); } }} />
              <button type="button" className="btn" onClick={lancer} disabled={attente || texte.trim().length < 3}>{attente && !distributeur ? 'Recherche…' : 'Chercher'}</button>
            </div>
            <span className="aide">Nom, producteur, appellation… La recherche couvre les vins connus de Quid Vinum et les catalogues de ses distributeurs.</span>
          </div>
          {distributeurs.length > 0 && (
            <div className="champ" style={{ margin: 0 }}>
              <label htmlFor="choix_distributeur">Ou parcourir le catalogue d’un distributeur</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select id="choix_distributeur" value={distributeur} onChange={(e) => parcourir(e.target.value)} style={{ flex: '1 1 200px' }}>
                  <option value="">— Choisir un distributeur —</option>
                  {distributeurs.map((d) => <option key={d.id} value={d.id}>{d.nom} ({d.vins} vins)</option>)}
                </select>
                {catalogue && <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer : producteur, vin, millésime…" aria-label="Filtrer le catalogue"
                  style={{ flex: '1 1 220px' }} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} />}
              </div>
            </div>
          )}
          <div role="status" aria-live="polite" className="pile" style={{ gap: 6 }}>
            {erreur && <span className="petit">La recherche n’a pas abouti. Réessayez.</span>}
            {/* Recherche ou catalogue en chargement : Pat attablé qui se balance, comme à la lecture de la carte. */}
            {attente && <span className="petit" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><PatAttente taille={40} />{distributeur ? 'Chargement du catalogue…' : 'Pat cherche ce vin…'}</span>}
            {trouves && !attente && (trouves.length
              ? <><span className="petit">{trouves.length === 1 ? 'Un vin trouvé :' : `${trouves.length} vins trouvés :`} cliquez sur le vôtre.</span>{trouves.map((v) => ligne(v, v.cle))}</>
              : <span className="petit">Nous ne connaissons pas encore ce vin.</span>)}
            {catalogue && !attente && <>
              <span className="petit discret">{visibles.length} vin{visibles.length > 1 ? 's' : ''}{visibles.length > MAX ? ` : les ${MAX} premiers sont affichés, filtrez la liste` : ''}.</span>
              {visibles.slice(0, MAX).map((v) => ligne(v, v.offres?.[0]?.id ?? v.cle))}
            </>}
          </div>
          <span><button type="button" className="btn fantome petit" onClick={decrire}>Je ne le trouve pas : le décrire moi-même</button></span>
        </>
      )}
    </div>
  );
}
