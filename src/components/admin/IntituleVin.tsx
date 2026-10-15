'use client';
// Intitulé du vin dans sa fiche du back-office. Tant que le restaurant ne l'a pas écrit lui-même, il se recompose
// à chaque frappe à partir de l'appellation, du nom du vin, du cépage et du producteur (champs du même formulaire).
import { useEffect, useRef, useState } from 'react';
import { composerIntitule } from '@/lib/admin/intitule';

const CHAMPS = ['appellation_texte', 'nom_vin', 'cepages', 'producteur_texte'];

function composer(form: HTMLFormElement | null) {
  const v = (k: string) => (form?.elements.namedItem(k) as HTMLInputElement | null)?.value ?? '';
  return composerIntitule({ appellation: v('appellation_texte'), nom: v('nom_vin'), cepage: v('cepages'), producteur: v('producteur_texte') });
}

export function IntituleVin({ initial }: { initial: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [valeur, setValeur] = useState(initial);
  const [auto, setAutoEtat] = useState(false);
  const [propose, setPropose] = useState(initial);
  const autoRef = useRef(false);
  const setAuto = (a: boolean) => { autoRef.current = a; setAutoEtat(a); };

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
        onChange={(e) => { setValeur(e.target.value); setAuto(e.target.value === propose); }} />
      <span className="aide">
        {auto
          ? 'Composé à partir de l’appellation, du nom du vin, du cépage et du producteur. Écrivez ici pour le personnaliser.'
          : <>Cet intitulé ne suit pas les champs ci-dessous.{propose && propose !== valeur && <> <button type="button" className="bouton-lien" onClick={() => { setValeur(propose); setAuto(true); }}>Utiliser « {propose} »</button></>}</>}
      </span>
    </div>
  );
}
