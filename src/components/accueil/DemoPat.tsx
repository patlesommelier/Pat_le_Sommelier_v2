'use client';
// Haut de la page d'accueil : Pat attablé, le QR code de la démo et un téléphone, animés ensemble en boucle :
//   1. une bulle de client : « Que boire avec l'émincé de bar ? » ;
//   2. dans le téléphone, la vidéo de l'app Chez Pat : on touche l'émincé de bar, puis « Trouver mon vin », la liste des vins s'affiche ;
//   3. la bulle de Pat, à côté du téléphone : il conseille le premier vin de la liste ;
//   4. tout s'efface doucement, et la scène recommence.
// La vidéo (public/demo/chez-pat-bar.webm et .mp4) est un enregistrement de la vraie app de démo (en ligne, restaurant L'Improbable) ; les temps ci-dessous suivent la vidéo.
import { useEffect, useRef, useState } from 'react';
import s from './carnet.module.css';

const VIDEO = '/demo/chez-pat-bar'; // .webm (Chrome, Firefox, Android) et .mp4 (Safari, iPhone)
const QUESTION = 'Que boire avec l’émincé de bar ?';
const REPONSE = 'Je te conseille le Sancerre Terre de Maimbray 2022 de Reverdy, il est parfait avec le bar.';
// En millisecondes.
const AVANT_VIDEO = 1800; // la question seule, avant que le téléphone s'anime
const LISTE = 4700; // dans la vidéo : la liste des vins est à l'écran
const DUREE_VIDEO = 8300;
const TENUE = 6000; // la réponse reste lisible
const FONDU = 900; // effacement avant de recommencer

type Etape = 'question' | 'app' | 'reponse' | 'fin';

export function DemoPat() {
  const video = useRef<HTMLVideoElement>(null);
  const [etape, setEtape] = useState<Etape>('question');
  const [calme, setCalme] = useState(false); // « réduire les animations » : la scène finale, immobile

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setCalme(true); return; }
    const minuteurs: ReturnType<typeof setTimeout>[] = [];
    const apres = (ms: number, f: () => void) => minuteurs.push(setTimeout(f, ms));
    const tour = () => {
      setEtape('question');
      const v = video.current;
      if (v) { v.pause(); v.currentTime = 0; }
      apres(AVANT_VIDEO, () => { setEtape('app'); video.current?.play().catch(() => { /* lecture refusée : la scène continue sans la vidéo */ }); });
      apres(AVANT_VIDEO + LISTE, () => setEtape('reponse'));
      apres(AVANT_VIDEO + DUREE_VIDEO + TENUE, () => setEtape('fin'));
      apres(AVANT_VIDEO + DUREE_VIDEO + TENUE + FONDU + 400, tour);
    };
    tour();
    return () => minuteurs.forEach(clearTimeout);
  }, []);

  const question = calme || etape !== 'fin';
  const reponse = calme || etape === 'reponse';
  return (
    <div className={s.sceneLigne}>
      <div className={s.scene}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat-attable-rouge.svg" alt="Pat, le sommelier, attablé avec sa bouteille et son verre" width={560} height={440} />
        <p className={`${s.bulle} ${s.bulleClient}`} data-visible={question} aria-hidden={!question}>« {QUESTION} »</p>
        {/* Sur téléphone (pas de téléphone dessiné), la réponse de Pat reste près de lui. */}
        <p className={`${s.bulle} ${s.bullePat} ${s.bulleMobile}`} data-visible={reponse} aria-hidden="true">{REPONSE}</p>
      </div>
      {/* QR de l'app de démo Chez Pat, rouge comme Pat */}
      <a className={s.qr} href="/chez-pat" target="_blank" rel="noopener">
        Scannez ici
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/demo-qr?couleur=pat" alt="QR code à scanner pour essayer l’app de démonstration Chez Pat" width={84} height={84} />
      </a>
      {/* Le téléphone : la vidéo de l'app (ordinateur seulement) ; un clic ouvre la vraie démo. */}
      <div className={s.telephoneBloc}>
      {/* La réponse de Pat, à côté du téléphone qui vient d'afficher les vins. */}
      <p className={`${s.bulle} ${s.bulleTelephone}`} data-visible={reponse} aria-hidden={!reponse}>{REPONSE}</p>
      <a className={s.telephone} href="/chez-pat" target="_blank" rel="noopener" aria-label="Ouvrir l’app de démonstration Chez Pat">
        <video ref={video} poster={calme ? '/demo/chez-pat-bar-fin.jpg' : '/demo/chez-pat-bar-debut.jpg'} muted playsInline preload="auto" aria-hidden="true">
          <source src={`${VIDEO}.webm`} type="video/webm" />
          <source src={`${VIDEO}.mp4`} type="video/mp4" />
        </video>
      </a>
      </div>
    </div>
  );
}
