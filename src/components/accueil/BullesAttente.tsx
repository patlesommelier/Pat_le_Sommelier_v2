'use client';
// Pendant l'inscription, Pat parle au restaurateur dans une bulle, juste sous le dépôt des fichiers :
// - dès le premier dépôt (lecture de la carte des vins et du menu) : ses avantages, un toutes les 10 secondes ;
// - préparation des accords : ses fonctionnalités.
// Chaque changement se fait en douceur : l'ancienne bulle s'efface lentement, puis la nouvelle apparaît.
// La phase arrive de l'inscription par l'évènement « pat:phase-inscription » (voir annoncerPhase).
import { useEffect, useState } from 'react';
import s from './carnet.module.css';
import { AVANTAGES, FONCTIONNALITES, Ic } from './Sections';

export type PhaseInscription = 'lecture' | 'accords' | null;
const EVENEMENT = 'pat:phase-inscription';
// Dernière phase annoncée, gardée pour les bulles si elles s'abonnent après l'annonce (premier affichage de la page).
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

export function BullesAttente() {
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

  // Nouvelle bulle demandée : effacement lent de l'actuelle, puis apparition de la nouvelle.
  useEffect(() => {
    if (voulu.phase === vue.phase && voulu.n === vue.n) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setVue(voulu); return; }
    setVisible(false);
    const t = setTimeout(() => { setVue(voulu); setVisible(true); }, vue.phase ? FONDU : 0);
    return () => clearTimeout(t);
  }, [voulu, vue]);

  if (!vue.phase) return null;
  const { surtitre, items } = LISTES[vue.phase];
  const item = items[vue.n % items.length];
  return (
    <div className={s.attente} data-visible={visible} aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span className={s.attenteAvatar}><img src="/pat/pat-avatar.svg" alt="Pat" /></span>
      <div className={s.attenteBulle}>
        <span className={s.attenteSurtitre}>{surtitre} · {(vue.n % items.length) + 1}/{items.length}</span>
        <div className={s.attenteItem}>
          <span className={s.attenteIcone}><Ic d={item.d} /></span>
          <div><strong>{item.titre}</strong><p>{item.texte}</p></div>
        </div>
      </div>
    </div>
  );
}
