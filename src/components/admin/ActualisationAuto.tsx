'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Recharge les données de la page à intervalle régulier (suivi d'une régénération en cours). */
export function ActualisationAuto({ secondes = 5 }: { secondes?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), secondes * 1000);
    return () => clearInterval(t);
  }, [router, secondes]);
  return null;
}
