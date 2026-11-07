'use client';
// Bouton d'une recherche faite par Pat : pendant l'envoi, Pat attablé se balance à côté (comme à la lecture de la carte).
import { useFormStatus } from 'react-dom';
import { PatAttente } from '@/components/PatAttente';

export function BoutonRecherchePat({ className, children, enCours, clair = false }: { className?: string; children: React.ReactNode; enCours: string; clair?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button className={className} disabled={pending}>{children}</button>
      {pending && <span className="attente-pat" role="status"><PatAttente taille={44} clair={clair} />{enCours}</span>}
    </>
  );
}
