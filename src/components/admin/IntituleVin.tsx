'use client';
// Intitulé du vin dans sa fiche du back-office. Tant que le restaurant ne l'a pas écrit lui-même, il se recompose
// à chaque frappe à partir de l'appellation, du nom du vin, du cépage et du producteur (champs du même formulaire).
// À l'ajout d'un vin (`chercher` fourni) : l'intitulé tapé est cherché dans la base de Pat et, s'il y est, les champs
// qui suivent sont préremplis (couleur, région, appellation, nom du vin, cépages, producteur).
import { useEffect, useRef, useState } from 'react';
import { composerIntitule } from '@/lib/admin/intitule';
import type { VinTrouve } from '@/lib/admin/recherche-base';

const CHAMPS = ['appellation_texte', 'nom_vin', 'cepages', 'producteur_texte'];

function composer(form: HTMLFormElement | null) {
  const v = (k: string) => (form?.elements.namedItem(k) as HTMLInputElement | null)?.value ?? '';
  return composerIntitule({ appellation: v('appellation_texte'), nom: v('nom_vin'), cepage: v('cepages'), producteur: v('producteur_texte') });
}

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blanc', rose: 'Rosé', rouge: 'Rouge', orange: 'Orange', doux: 'Doux', sans_alcool: 'Sans alcool' };

/** Remplit les champs du formulaire avec un vin de la base ; ce que la base ne sait pas est vidé (la couleur reste). */
function preremplir(form: HTMLFormElement | null, v: VinTrouve) {
  const poser = (nom: string, valeur: string | null) => {
    const el = form?.elements.namedItem(nom) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = valeur ?? '';
  };
  if (v.couleur && COULEURS[v.couleur]) poser('couleur', v.couleur);
  poser('section', v.section);
  poser('appellation_texte', v.appellation);
  poser('nom_vin', v.nom_vin);
  poser('cepages', v.cepages);
  poser('producteur_texte', v.producteur);
}

const resume = (v: VinTrouve) => [v.libelle, v.producteur && !v.libelle.toLowerCase().includes(v.producteur.toLowerCase()) ? v.producteur : null,
  v.couleur ? COULEURS[v.couleur]?.toLowerCase() : null].filter(Boolean).join(' · ');

export function IntituleVin({ initial, chercher }: { initial: string; chercher?: (texte: string) => Promise<VinTrouve[]> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [valeur, setValeur] = useState(initial);
  const [auto, setAutoEtat] = useState(false);
  const [propose, setPropose] = useState(initial);
  const autoRef = useRef(false);
  const setAuto = (a: boolean) => { autoRef.current = a; setAutoEtat(a); };
  // Recherche dans la base de Pat (ajout d'un vin seulement)
  const [trouves, setTrouves] = useState<VinTrouve[] | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [cherche, setCherche] = useState(false);
  const dernier = useRef('');
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lancer = (texte: string) => {
    const t = texte.trim();
    if (!chercher || t.length < 4 || t === dernier.current) return;
    dernier.current = t;
    setCherche(true);
    chercher(t).then((liste) => {
      if (dernier.current !== t) return; // une recherche plus récente a été lancée
      setTrouves(liste);
      const sur = liste[0]?.complet ? liste[0] : null;
      setChoisi(sur?.cle ?? null);
      if (sur) preremplir(ref.current?.form ?? null, sur);
    }).catch(() => setTrouves(null)).finally(() => setCherche(false));
  };
  const choisir = (v: VinTrouve) => { setChoisi(v.cle); preremplir(ref.current?.form ?? null, v); };

  useEffect(() => {
    const form = ref.current?.form ?? null;
    const p = composer(form);
    setPropose(p);
    setAuto(p === initial); // intitulé déjà égal à la composition : il suit les champs
    const suivre = (e: Event) => {
      if (!CHAMPS.includes((e.target as HTMLInputElement).name)) return;
      const n = composer(form);
      setPropose(n);
      if (autoRef.current) setValeur(n);
    };
    form?.addEventListener('input', suivre);
    return () => form?.removeEventListener('input', suivre);
  }, [initial]);

  return (
    <div className="champ">
      <label htmlFor="libelle">Intitulé du vin</label>
      <input ref={ref} id="libelle" name="libelle" value={valeur} placeholder={propose || 'Appellation et nom du vin'}
        onChange={(e) => {
          setValeur(e.target.value); setAuto(e.target.value === propose);
          if (chercher) { const t = e.target.value; if (minuteur.current) clearTimeout(minuteur.current); minuteur.current = setTimeout(() => lancer(t), 700); }
        }}
        onBlur={(e) => { if (minuteur.current) clearTimeout(minuteur.current); lancer(e.target.value); }} />
      {chercher && <input type="hidden" name="base_cle" value={choisi ?? ''} />}
      {chercher && (cherche || trouves) && (
        <div className="pile" role="status" aria-live="polite" style={{ gap: 6, marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--ligne)' }}>
          {cherche ? <span className="petit">Pat cherche ce vin dans sa base…</span>
            : !trouves?.length ? <span className="petit">Ce vin n’est pas encore dans la base de Pat : complétez les champs ci-dessous.</span>
              : (<>
                <span className="petit">{choisi ? <>Trouvé dans la base de Pat : <b>{resume(trouves.find((v) => v.cle === choisi)!)}</b>. Les champs ci-dessous sont préremplis, vérifiez-les.</>
                  : 'Est-ce l’un de ces vins de la base de Pat ? Choisissez-le pour préremplir les champs.'}</span>
                {trouves.filter((v) => v.cle !== choisi).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {choisi && <span className="petit">Ce n’est pas lui ?</span>}
                    {trouves.filter((v) => v.cle !== choisi).map((v) => (
                      <button key={v.cle} type="button" className="btn sec petit" style={{ whiteSpace: 'normal', textAlign: 'left' }} onClick={() => choisir(v)}>{resume(v)}</button>
                    ))}
                  </div>
                )}
              </>)}
        </div>
      )}
      <span className="aide">
        {auto
          ? 'Composé à partir de l’appellation, du nom du vin, du cépage et du producteur. Écrivez ici pour le personnaliser.'
          : <>Cet intitulé ne suit pas les champs ci-dessous.{propose && propose !== valeur && <> <button type="button" className="bouton-lien" onClick={() => { setValeur(propose); setAuto(true); }}>Utiliser « {propose} »</button></>}</>}
      </span>
    </div>
  );
}
