'use client';
// Vidéo de l'app de Pat dans le téléphone de la page d'accueil : jouée plus lentement que l'enregistrement (lisible sur mobile),
// avec une pause sur les propositions de Pat avant de recommencer.
import { useEffect, useRef } from 'react';

const VITESSE = 0.55;
const PAUSE_FIN = 4000; // ms sur la dernière image (les vins proposés)

export function VideoDemo({ video }: { video: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let attente: ReturnType<typeof setTimeout> | undefined;
    const vitesse = () => { v.playbackRate = VITESSE; };
    const fin = () => { attente = setTimeout(() => { v.currentTime = 0; vitesse(); v.play().catch(() => {}); }, PAUSE_FIN); };
    vitesse();
    v.addEventListener('loadedmetadata', vitesse);
    v.addEventListener('play', vitesse);
    v.addEventListener('ended', fin);
    v.play().catch(() => { /* lecture automatique refusée : l'image d'attente reste affichée */ });
    return () => { clearTimeout(attente); v.removeEventListener('loadedmetadata', vitesse); v.removeEventListener('play', vitesse); v.removeEventListener('ended', fin); };
  }, []);
  return (
    <video ref={ref} muted autoPlay playsInline preload="metadata" poster={`${video}-debut.jpg`}>
      <source src={`${video}.webm`} type="video/webm" />
      <source src={`${video}.mp4`} type="video/mp4" />
    </video>
  );
}
