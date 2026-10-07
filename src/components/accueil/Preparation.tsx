'use client';
// Fin de l'inscription, dans le cadre doré : Pat prépare les accords (barre d'avancement), puis le QR code
// s'affiche (« C'est prêt, scannez ») ; dès que l'app est ouverte avec ce QR code, on bascule vers l'espace du restaurant.
import { useEffect, useState } from 'react';
import s from './accueil.module.css';
import { PatAttente } from '@/components/PatAttente';

type Etat = { restaurant?: string; scanne?: boolean; preparation: { statut: string; total: number; faits: number } };

export function Preparation({ restaurantId }: { restaurantId: string }) {
  const [etat, setEtat] = useState<Etat>({ preparation: { statut: 'en_cours', total: 0, faits: 0 } });
  const pret = etat.restaurant === 'en_service';
  const espace = `/admin/${restaurantId}`;

  useEffect(() => {
    let actif = true;
    // On ne bascule vers l'espace que si l'app est ouverte pour la première fois après l'affichage du QR code ici.
    let dejaOuverte: boolean | null = null;
    const lire = async () => {
      const r = await fetch(`/api/restaurants/${restaurantId}/preparation`, { cache: 'no-store', redirect: 'manual' }).catch(() => null);
      if (!r?.ok || !actif) return;
      const e: Etat | null = await r.json().catch(() => null);
      if (!e?.preparation) return;
      if (e.restaurant === 'en_service') {
        if (dejaOuverte === null) dejaOuverte = Boolean(e.scanne);
        else if (!dejaOuverte && e.scanne) { window.location.href = espace; return; } // QR code scanné
      }
      setEtat(e);
    };
    lire();
    const t = setInterval(lire, 3000);
    return () => { actif = false; clearInterval(t); };
  }, [restaurantId, espace]);

  const { total, faits, statut } = etat.preparation;
  const pct = pret ? 100 : total ? Math.round((faits / total) * 100) : 0;

  if (pret) {
    return (
      <div className={s.pret} role="status" aria-live="polite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${espace}/acces/qr?affichage=1`} alt="QR code de votre app" width={200} height={200} className={s.pretQr} />
        <div className={s.pretTexte}>
          <strong>C’est prêt !</strong>
          <span>Scannez ce QR code avec votre téléphone : vous verrez votre sommelier comme vos clients le verront.</span>
          <span className={s.pretLiens}>
            <a href={`${espace}/acces/qr?format=png`} download>Télécharger le QR code</a>
            <a href={espace}>Aller à mon espace</a>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className={s.attente} role="status" aria-live="polite" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}><PatAttente taille={52} /><b>Pat prépare vos accords…</b></span>
      <span role="progressbar" aria-label="Préparation des accords" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={s.barre}>
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className={s.detail}>
        {statut === 'bloque' ? `${faits} plats sur ${total} · quelques plats demandent une vérification de Pat ; votre QR code s’affichera ici dès qu’ils auront tous leurs accords.`
          : `${total ? `${faits} plats sur ${total}` : 'Démarrage…'} · quelques minutes.`}
      </span>
    </div>
  );
}
