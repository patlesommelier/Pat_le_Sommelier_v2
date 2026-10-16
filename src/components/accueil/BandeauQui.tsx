'use client';
// Bandeau « Qui est Pat ? » de la page d'accueil. Pendant l'inscription, il occupe l'attente :
// - lecture de la carte des vins et du menu : les avantages de Pat défilent (un toutes les 10 secondes) ;
// - préparation des accords : les fonctionnalités défilent.
// La phase arrive de l'inscription par l'évènement « pat:phase-inscription » (voir annoncerPhase).
import { useEffect, useState, type ReactNode } from 'react';
import s from './carnet.module.css';
import { AVANTAGES, FONCTIONNALITES, Ic } from './Sections';

export type PhaseInscription = 'lecture' | 'accords' | null;
const EVENEMENT = 'pat:phase-inscription';
export const annoncerPhase = (phase: PhaseInscription) => window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: phase }));

const LISTES = {
  lecture: { surtitre: 'Pendant que je lis vos fichiers', items: AVANTAGES },
  accords: { surtitre: 'Pendant que je prépare vos accords', items: FONCTIONNALITES },
};

export function BandeauQui({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<PhaseInscription>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const recevoir = (e: Event) => { setPhase((e as CustomEvent<PhaseInscription>).detail); setN(0); };
    window.addEventListener(EVENEMENT, recevoir);
    return () => window.removeEventListener(EVENEMENT, recevoir);
  }, []);
  useEffect(() => {
    if (!phase) return;
    const t = setInterval(() => setN((x) => x + 1), 10000);
    return () => clearInterval(t);
  }, [phase]);

  if (!phase) return <>{children}</>;
  const { surtitre, items } = LISTES[phase];
  const item = items[n % items.length];
  return (
    <div className={s.quiDefile} aria-live="polite">
      <span className={s.quiSurtitre}>{surtitre} · {(n % items.length) + 1}/{items.length}</span>
      <div key={`${phase}-${n}`} className={s.quiItem}>
        <span className={s.quiIcone}><Ic d={item.d} /></span>
        <div><h2>{item.titre}</h2><p>{item.texte}</p></div>
      </div>
    </div>
  );
}
