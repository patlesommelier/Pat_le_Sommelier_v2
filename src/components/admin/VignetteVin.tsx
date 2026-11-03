'use client';
// Vignette d'un vin : sa photo ; si elle manque, ne se charge pas ou est vide (image « pas de photo » toute blanche),
// le logo de son distributeur ; sinon une bouteille.
import { useEffect, useRef, useState } from 'react';
import { Icone } from './Icone';
import { imageVide } from '@/lib/image-vide';

export function VignetteVin({ url, logo, taille = 52 }: { url: string | null | undefined; logo?: string | null; taille?: number }) {
  const sources = [url, logo].filter((x): x is string => Boolean(x && x.trim()));
  const [rang, setRang] = useState(0);
  // Photo d'un autre site (stockage) : d'abord lue « partagée » pour pouvoir l'examiner ; si ce site le refuse, chargée normalement.
  const [simple, setSimple] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const src = sources[rang];
  const externe = Boolean(src && !src.startsWith('/'));
  const suivante = () => { setSimple(false); setRang((r) => r + 1); };
  const examiner = (img: HTMLImageElement) => { if (src !== logo && imageVide(img)) suivante(); };
  // Image déjà chargée avant que la page ne soit interactive (rendu serveur) : examinée ici.
  useEffect(() => {
    const img = ref.current;
    if (!img?.complete) return;
    if (!img.naturalWidth) { if (externe && !simple) setSimple(true); else suivante(); } else examiner(img);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, simple]);
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img ref={ref} key={`${src}-${simple}`} className={`vignette${src === logo ? ' vignette-logo' : ''}`} src={src} alt="" style={{ width: taille, height: taille }}
    crossOrigin={externe && !simple ? 'anonymous' : undefined}
    onError={() => (externe && !simple ? setSimple(true) : suivante())}
    onLoad={(e) => examiner(e.currentTarget)} />;
  return <span className="vignette vide" style={{ width: taille, height: taille }} aria-hidden="true"><Icone nom="bottle" taille={22} /></span>;
}
