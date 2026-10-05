'use client';
// Interroge l'avancement de la préparation des accords toutes les 5 secondes ;
// quand tous les plats ont leurs accords (restaurant en service), la page se recharge et montre le QR code.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import s from '../inscription.module.css';

type Statut = { restaurant?: string; preparation?: { statut?: string; total: number; faits: number } };

export function Progression() {
  const router = useRouter();
  const [st, setSt] = useState<Statut>({});
  useEffect(() => {
    let actif = true;
    const lire = async () => {
      const r = await fetch('/inscription/statut', { cache: 'no-store' });
      if (r.ok && actif) setSt(await r.json());
    };
    lire();
    const t = setInterval(lire, 5000);
    return () => { actif = false; clearInterval(t); };
  }, []);
  useEffect(() => { if (st.restaurant === 'en_service') router.refresh(); }, [st.restaurant, router]);
  const p = st.preparation ?? { total: 0, faits: 0 };
  const pct = p.total ? Math.round((p.faits / p.total) * 100) : 0;
  if (st.restaurant === 'en_service') return <p className={s.succes} role="status">Vos accords sont prêts : votre QR code arrive.</p>;
  return (
    <div className={s.carte} role="status" aria-live="polite">
      <strong>{p.statut === 'bloque' ? 'Pat vérifie les derniers plats' : 'Pat prépare vos accords'}</strong>
      <div className={s.progression} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Préparation des accords">
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className={s.texte} style={{ fontSize: 14 }}>
        {p.total ? `${p.faits} plats sur ${p.total}` : 'Démarrage…'}
        {p.statut === 'bloque'
          ? ' · Quelques plats demandent une vérification de Pat. Votre QR code sera prêt dès qu’ils auront tous leurs accords ; il sera aussi dans votre espace.'
          : ' · Quelques minutes. Votre QR code apparaît ici dès que tous vos plats ont leurs accords ; vous le retrouverez aussi dans votre espace.'}
      </span>
    </div>
  );
}
