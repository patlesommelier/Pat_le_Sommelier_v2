'use client';
// Fin de l'inscription, dans le cadre doré : Pat prépare les accords (barre d'avancement) ; dès qu'ils sont prêts, on
// arrive dans le simulateur de l'espace restaurant, sur un de ses plats : ce que ses clients verront (l'effet « waouh »).
import { useEffect, useState } from 'react';
import s from './accueil.module.css';
import { PatAttente } from '@/components/PatAttente';
import { AstucesPat } from '@/components/AstucesPat';

type Etat = { restaurant?: string; scanne?: boolean; termine?: boolean; preparation: { statut: string; total: number; faits: number } };

export function Preparation({ restaurantId }: { restaurantId: string }) {
  const [etat, setEtat] = useState<Etat>({ preparation: { statut: 'en_cours', total: 0, faits: 0 } });
  const pret = Boolean(etat.termine);
  const espace = `/admin/${restaurantId}`;
  // Première arrivée dans l'espace : le simulateur, avec le bandeau « Vos accords sont prêts ».
  const arrivee = `${espace}/simulateur?bienvenue=1`;

  useEffect(() => {
    let actif = true;
    const lire = async () => {
      const r = await fetch(`/api/restaurants/${restaurantId}/preparation`, { cache: 'no-store', redirect: 'manual' }).catch(() => null);
      if (!r?.ok || !actif) return;
      const e: Etat | null = await r.json().catch(() => null);
      if (!e?.preparation) return;
      if (e.termine) { window.location.href = arrivee; return; } // tous les accords prêts : au simulateur
      setEtat(e);
    };
    lire();
    const t = setInterval(lire, 3000);
    return () => { actif = false; clearInterval(t); };
  }, [restaurantId, espace, arrivee]);

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
            <a href={arrivee}>Aller à mon espace</a>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className={s.attente} role="status" aria-live="polite" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
      {/* Pat puis le texte qui défile, l'un sous l'autre, au milieu de la boîte */}
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><PatAttente taille={64} /><AstucesPat className={s.astuces} /></span>
      <span role="progressbar" aria-label="Préparation des accords" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={s.barre}>
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className={s.detail} style={{ textAlign: 'center' }}>
        {statut === 'bloque' ? `${faits} plats sur ${total} · quelques plats demandent une vérification de Pat ; votre QR code s’affichera ici dès qu’ils auront tous leurs accords.`
          : `${total ? `${faits} plats sur ${total}` : 'Démarrage…'} · quelques minutes.`}
      </span>
    </div>
  );
}
