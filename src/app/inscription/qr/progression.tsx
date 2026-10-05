'use client';
// Interroge l'avancement de la préparation des accords toutes les 5 secondes.
import { useEffect, useState } from 'react';
import s from '../inscription.module.css';

type Statut = { restaurant?: string; preparation?: { statut?: string; total: number; faits: number } };

export function Progression() {
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
  const p = st.preparation ?? { total: 0, faits: 0 };
  const pct = p.total ? Math.round((p.faits / p.total) * 100) : 0;
  if (st.restaurant === 'en_service') return <p className={s.succes} role="status">Vos accords sont prêts : le QR code fonctionne.</p>;
  if (p.statut === 'erreur') return <p className={s.alerte} role="status">La préparation a rencontré un problème. Pat a été prévenu et la relancera.</p>;
  return (
    <div className={s.carte} role="status" aria-live="polite">
      <strong>Pat prépare vos accords</strong>
      <div className={s.progression} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Préparation des accords">
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className={s.texte} style={{ fontSize: 14 }}>
        {p.total ? `${p.faits} plats sur ${p.total}` : 'Démarrage…'} · environ 10 minutes. Le QR code fonctionne dès que c’est terminé ; nous vous prévenons par e-mail.
      </span>
    </div>
  );
}
