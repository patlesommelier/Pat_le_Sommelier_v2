'use client';
// Bouton qui envoie le formulaire où il se trouve vers une autre action (formAction), après confirmation.
export function BoutonAction({ action, libelle, question, className = 'btn sec petit' }: {
  action: (f: FormData) => void | Promise<void>; libelle: string; question: string; className?: string;
}) {
  return <button type="submit" formAction={action} formNoValidate className={className}
    onClick={(e) => { if (!window.confirm(question)) e.preventDefault(); }}>{libelle}</button>;
}
