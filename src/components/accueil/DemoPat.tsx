'use client';
// Haut de la page d'accueil : Pat attablé, le QR code de la démo et un téléphone, animés ensemble en boucle, en deux actes :
//   1. un client : « Que boire avec l'émincé de bar ? » ; dans le téléphone, la vidéo de l'app : on touche l'émincé de bar,
//      « Trouver mon vin », la liste des vins s'affiche ; à côté du téléphone, Pat conseille le premier vin (un blanc) et explique l'accord ;
//   2. le client : « Après, je prends le filet pur au poivre vert… » ; dans l'app, retour au menu, le filet, « Trouver mon vin » ;
//      Pat conseille le premier vin (un rouge) et explique l'accord ;
//   puis les bulles s'effacent et le téléphone devient le simulateur : la vraie app, que le visiteur peut essayer.
// Les vidéos (public/demo/demo-1-bar et demo-2-filet, en .webm et .mp4) sont des enregistrements de la vraie app de démo
// en ligne (restaurant L'Improbable) ; les explications sont celles que l'app affiche. Les temps ci-dessous suivent les vidéos.
import { useEffect, useRef, useState } from 'react';
import s from './carnet.module.css';

const ACTES = [
  {
    video: '/demo/demo-1-bar',
    // Espaces insécables autour des guillemets : ils ne restent jamais seuls sur une ligne.
    question: '«\u00A0Que boire avec l’émincé de bar\u202F?\u00A0»',
    reponse: 'Je te conseille le Sancerre Terre de Maimbray 2022 de Reverdy. Les caillottes de Maimbray donnent à ce sauvignon une tension vive qui répond au citron vert et respecte le bar, c’est un accord que j’apprécie beaucoup.',
    liste: 6400, // dans la vidéo, à vitesse normale : la liste des vins est à l'écran (ms)
  },
  {
    video: '/demo/demo-2-filet',
    question: '«\u00A0Après, je prends le filet pur au poivre vert. Que me conseilles-tu\u202F?\u00A0»',
    reponse: 'Je te conseille le Moulin-à-Vent Michelon 2014 du Domaine Jules Desjourneys. Ce Moulin-à-Vent de 2014 aux tanins fondus fait écho au poivre vert par ses notes poivrées et son sous-bois, je ne m’en lasse pas, et pourtant j’ai essayé.',
    liste: 6100,
  },
];
// La vidéo passe 30 % moins vite que l'enregistrement (on suit mieux le doigt) ; les temps de la vidéo sont ajustés d'autant.
const VITESSE = 0.7;
// En millisecondes.
const QUESTION_SEULE = 1800; // la question, avant que le téléphone s'anime
const LECTURE = 8500; // la réponse reste à l'écran
const FONDU = 900; // effacement des bulles

export function DemoPat() {
  const videos = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [acte, setActe] = useState(0);
  const [question, setQuestion] = useState(true);
  const [reponse, setReponse] = useState(false);
  const [simulateur, setSimulateur] = useState(false); // la scène jouée une fois : le téléphone montre la vraie app

  useEffect(() => {
    // « Réduire les animations » : pas de scène, le simulateur tout de suite.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setQuestion(false); setSimulateur(true); return; }
    const minuteurs: ReturnType<typeof setTimeout>[] = [];
    let t = 0;
    const a = (ms: number, f: () => void) => { t += ms; minuteurs.push(setTimeout(f, t)); };
    const jouer = (n: number) => { const v = videos[n].current; if (v) v.playbackRate = VITESSE; return v?.play().catch(() => { /* lecture refusée : la scène continue sans la vidéo */ }); };
    const tour = () => {
      t = 0;
      videos.forEach((v) => { if (v.current) { v.current.pause(); v.current.currentTime = 0; } });
      setActe(0); setQuestion(true); setReponse(false);
      // Acte 1 : l'émincé de bar.
      a(QUESTION_SEULE, () => jouer(0));
      a(ACTES[0].liste / VITESSE, () => setReponse(true));
      a(LECTURE, () => { setQuestion(false); setReponse(false); });
      // Acte 2 : le filet au poivre vert (la vidéo part de la liste des vins du bar, là où la première s'arrête).
      a(FONDU, () => { setActe(1); setQuestion(true); });
      a(QUESTION_SEULE, () => jouer(1));
      a(ACTES[1].liste / VITESSE, () => setReponse(true));
      a(LECTURE, () => { setQuestion(false); setReponse(false); });
      // Fin de la scène : le simulateur remplace les vidéos.
      a(FONDU, () => setSimulateur(true));
    };
    tour();
    return () => minuteurs.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { question: q, reponse: r } = ACTES[acte];
  return (
    <div className={s.sceneLigne}>
      <div className={s.scene}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat-attable-rouge.svg" alt="Pat, le sommelier, attablé avec sa bouteille et son verre" width={560} height={440} />
        <p className={`${s.bulle} ${s.bulleClient}`} data-visible={question} aria-hidden={!question}>{q}</p>
        {/* Sur téléphone (pas de téléphone dessiné), la réponse de Pat reste près de lui. */}
        <p className={`${s.bulle} ${s.bullePat} ${s.bulleMobile}`} data-visible={reponse} aria-hidden="true">{r}</p>
      </div>
      {/* QR de l'app de démo, rouge comme Pat */}
      <a className={s.qr} href="/chez-pat" target="_blank" rel="noopener">
        Scannez ici
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/demo-qr?couleur=pat" alt="QR code à scanner pour essayer l’app de démonstration" width={84} height={84} />
      </a>
      {/* Le téléphone (ordinateur seulement) : les vidéos de la scène, puis le simulateur de l'app. */}
      <div className={s.telephoneBloc}>
        {/* La réponse de Pat, à côté du téléphone qui vient d'afficher les vins. */}
        <p className={`${s.bulle} ${s.bulleTelephone}`} data-visible={reponse} aria-hidden={!reponse}>{r}</p>
        <div className={s.telephone}>
          {simulateur
            // Le simulateur : la vraie app du restaurant de démo, rendue à la taille d'un téléphone puis réduite.
            ? <iframe src="/chez-pat" title="L’app de démonstration : essayez-la" className={s.simulateur} />
            : ACTES.map((x, n) => (
              <video key={x.video} ref={videos[n]} data-visible={n === acte} muted playsInline preload="auto" aria-hidden="true" poster={`${x.video}-debut.jpg`}>
                <source src={`${x.video}.webm`} type="video/webm" />
                <source src={`${x.video}.mp4`} type="video/mp4" />
              </video>
            ))}
        </div>
      </div>
    </div>
  );
}
