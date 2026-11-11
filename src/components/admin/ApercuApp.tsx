'use client';
// Simulateur : le téléphone montre la vraie app du restaurant. Quand on y choisit un plat (ou plusieurs, ou « autre chose »),
// la page suit : l'explication « Pourquoi ces vins ? » se met à jour, sans recharger le téléphone.
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function ApercuApp({ resto, src, garder }: {
  resto: string;
  /** Page de l'app ouverte au départ (le téléphone n'est plus rechargé ensuite). */
  src: string;
  /** Paramètres du simulateur à garder en suivant le téléphone (ex. bienvenue=1). */
  garder: Record<string, string>;
}) {
  const router = useRouter();
  const [depart] = useState(src);
  const cadre = useRef<HTMLIFrameElement>(null);

  const vu = useRef('');

  const suivre = () => {
    let chemin: string, recherche: URLSearchParams;
    try {
      const l = cadre.current?.contentWindow?.location;
      if (!l || l.href === vu.current) return;
      vu.current = l.href;
      chemin = l.pathname; recherche = new URLSearchParams(l.search);
    } catch { return; } // page d'un autre site : rien à suivre
    const m = chemin.match(new RegExp(`^/${resto}/plat/([^/]+)$`));
    if (!m) return; // accueil de l'app, carte des vins, fiche d'un vin : l'explication reste sur le dernier plat
    const plats = [decodeURIComponent(m[1]), ...(recherche.get('et') ?? '').split(',').filter(Boolean)];
    const q = new URLSearchParams();
    plats.forEach((p) => q.append('plat', p));
    const tour = recherche.get('tour');
    if (tour && tour !== '1') q.set('tour', tour);
    Object.entries(garder).forEach(([k, v]) => q.set(k, v));
    if (`?${q}` !== window.location.search) router.replace(`/admin/${resto}/simulateur?${q}`, { scroll: false });
  };

  // L'app change de page sans se recharger (navigation de Next) : son adresse est relue régulièrement.
  useEffect(() => {
    const t = setInterval(suivre, 400);
    return () => clearInterval(t);
  });

  return (
    <iframe ref={cadre} title="Aperçu de l’app client" src={depart} onLoad={suivre}
      style={{ width: 360, maxWidth: '100%', height: 740, border: '10px solid #241F20', borderRadius: 44, background: '#EFEBE9' }} />
  );
}
