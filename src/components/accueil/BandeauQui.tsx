'use client';
// Bandeau « Qui est Pat ? » de la page d'accueil. Pendant l'inscription, il occupe l'attente :
// - dès le premier dépôt (lecture de la carte des vins et du menu) : les avantages de Pat défilent (un toutes les 10 secondes) ;
// - préparation des accords : les fonctionnalités défilent.
// Chaque changement se fait en douceur : l'ancien texte s'efface lentement, puis le nouveau apparaît.
// La phase arrive de l'inscription par l'évènement « pat:phase-inscription » (voir annoncerPhase).
import { useEffect, useState, type ReactNode } from 'react';
import s from './carnet.module.css';
import { AVANTAGES, FONCTIONNALITES, Ic } from './Sections';

export type PhaseInscription = 'lecture' | 'accords' | null;
const EVENEMENT = 'pat:phase-inscription';
// Dernière phase annoncée, gardée pour le bandeau s'il s'abonne après l'annonce (premier affichage de la page).
let derniere: PhaseInscription = null;
export const annoncerPhase = (phase: PhaseInscription) => {
  derniere = phase;
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: phase }));
};

const LISTES = {
  lecture: { surtitre: 'Pendant que je lis vos fichiers', items: AVANTAGES },
  accords: { surtitre: 'Pendant que je prépare vos accords', items: FONCTIONNALITES },
};
const FONDU = 900; // ms, durée de l'effacement (et de l'apparition)

type Vue = { phase: PhaseInscription; n: number };

export function BandeauQui({ children }: { children: ReactNode }) {
  const [voulu, setVoulu] = useState<Vue>({ phase: null, n: 0 });
  const [vue, setVue] = useState<Vue>(voulu);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const recevoir = (phase: PhaseInscription) => setVoulu((v) => (v.phase === phase ? v : { phase, n: 0 }));
    recevoir(derniere);
    const ecouter = (e: Event) => recevoir((e as CustomEvent<PhaseInscription>).detail);
    window.addEventListener(EVENEMENT, ecouter);
    return () => window.removeEventListener(EVENEMENT, ecouter);
  }, []);
  useEffect(() => {
    if (!voulu.phase) return;
    const t = setInterval(() => setVoulu((v) => ({ ...v, n: v.n + 1 })), 10000);
    return () => clearInterval(t);
  }, [voulu.phase]);

  // Nouveau contenu demandé : effacement lent de l'actuel, puis apparition du nouveau.
  useEffect(() => {
    if (voulu.phase === vue.phase && voulu.n === vue.n) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setVue(voulu); return; }
    setVisible(false);
    const t = setTimeout(() => { setVue(voulu); setVisible(true); }, FONDU);
    return () => clearTimeout(t);
  }, [voulu, vue]);

  let contenu: ReactNode = children;
  if (vue.phase) {
    const { surtitre, items } = LISTES[vue.phase];
    const item = items[vue.n % items.length];
    contenu = (
      <div className={s.quiDefile}>
        <span className={s.quiSurtitre}>{surtitre} · {(vue.n % items.length) + 1}/{items.length}</span>
        <div className={s.quiItem}>
          <span className={s.quiIcone}><Ic d={item.d} /></span>
          <div><h2>{item.titre}</h2><p>{item.texte}</p></div>
        </div>
      </div>
    );
  }
  return <div className={s.quiFondu} data-visible={visible} aria-live="polite">{contenu}</div>;
}
