'use client';
import { useEffect, useRef, useState } from 'react';
import { imageVide } from '@/lib/image-vide';

/**
 * Étiquette du vin ; sans étiquette, le logo de son distributeur (sur fond blanc, entier) ; sinon un cadre comme une étiquette
 * avec le nom du vin.
 */
export function Etiquette({ url, logo, nom, largeur, hauteur }: { url: string | null; logo?: string | null; nom: string; largeur: number; hauteur: number }) {
  // Grand format (fiche vin) : centré et jamais plus large que l'écran.
  const taille = largeur > 200 ? { width: largeur, height: hauteur, maxWidth: '100%', alignSelf: 'center' as const } : { width: largeur, height: hauteur };
  // Photo absente, qui ne se charge pas ou vide (image « pas de photo » toute blanche) : le logo du distributeur, sinon le cadre.
  const sources = [url, logo].filter((x): x is string => Boolean(x && x.trim()));
  const [rang, setRang] = useState(0);
  const [simple, setSimple] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const src = sources[rang];
  const estLogo = Boolean(src) && src === logo && src !== url;
  const externe = Boolean(src) && !src!.startsWith('/');
  const suivante = () => { setSimple(false); setRang((r) => r + 1); };
  // Image déjà chargée avant que la page ne soit interactive (rendu serveur) : examinée ici.
  useEffect(() => {
    const img = ref.current;
    if (!img?.complete) return;
    if (!img.naturalWidth) { if (externe && !simple) setSimple(true); else suivante(); } else if (!estLogo && imageVide(img)) suivante();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, simple]);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img ref={ref} key={`${src}-${simple}`} className={`etiquette${estLogo ? ' etiquette-logo' : ''}`} src={src} alt={estLogo ? nom : `Étiquette ${nom}`} width={largeur} height={hauteur}
      style={estLogo ? { ...taille, padding: largeur < 70 ? 4 : 10 } : taille} loading="lazy"
      crossOrigin={externe && !simple ? 'anonymous' : undefined}
      onError={() => (externe && !simple ? setSimple(true) : suivante())}
      onLoad={(e) => { if (!estLogo && imageVide(e.currentTarget)) suivante(); }} />;
  }
  // Taille du nom selon la place : grand sur la fiche du vin, petit dans les listes.
  const police = largeur > 200 ? 20 : largeur >= 90 ? 12 : largeur >= 70 ? 10.5 : 6.8;
  return (
    <div className="etiquette-vide" role="img" aria-label={`${nom} (étiquette à venir)`} style={{ ...taille, padding: largeur < 70 ? 2 : 4 }}>
      <span className="etiquette-cadre" style={{ padding: largeur < 70 ? 1 : 3 }}><span className="etiquette-nom" style={{ fontSize: police }}>{nom}</span></span>
    </div>
  );
}
