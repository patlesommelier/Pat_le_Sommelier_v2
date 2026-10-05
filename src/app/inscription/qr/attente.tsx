'use client';
// Écran « Vérifiez votre e-mail » : l'adresse peut être confirmée sur un autre appareil.
// La page se recharge toutes les 5 secondes ; le serveur vérifie la confirmation chez Supabase.
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import s from '../inscription.module.css';

export function Attente() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <button type="button" className={s.bouton} disabled={enCours} onClick={() => demarrer(() => router.refresh())}>
      {enCours ? 'Vérification…' : 'J’ai confirmé mon adresse'}
    </button>
  );
}
