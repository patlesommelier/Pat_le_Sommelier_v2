'use client';
// Bouton d'envoi d'un formulaire qui montre que l'envoi est en cours (« Validation… ») : sans cela, rien ne bouge
// à l'écran pendant que le serveur travaille, et l'on croit que le clic n'a rien fait.
import { useFormStatus } from 'react-dom';

export function BoutonEnvoi({ className, name, value, enCours, formNoValidate, children }:
  { className?: string; name?: string; value?: string; enCours: string; formNoValidate?: boolean; children: React.ReactNode }) {
  const { pending, data } = useFormStatus();
  const lui = pending && (!name || data?.get(name) === value);
  return (
    <button className={className} name={name} value={value} formNoValidate={formNoValidate} disabled={pending} aria-busy={lui}>
      {lui ? enCours : children}
    </button>
  );
}
