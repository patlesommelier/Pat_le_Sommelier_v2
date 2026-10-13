'use client';
// Propositions pour plusieurs plats : pendant que Pat affine son choix (en arrière-plan), la page se met à jour
// toutes les 3 secondes, une minute au plus ; ensuite les propositions des règles restent affichées.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AttentePat() {
  const router = useRouter();
  const [fois, setFois] = useState(0);
  useEffect(() => {
    if (fois >= 20) return;
    const t = setTimeout(() => { router.refresh(); setFois((n) => n + 1); }, 3000);
    return () => clearTimeout(t);
  }, [fois, router]);
  if (fois >= 20) return null;
  return <p className="note-discrete" role="status" aria-live="polite">Pat affine sa sélection pour ces plats…</p>;
}
