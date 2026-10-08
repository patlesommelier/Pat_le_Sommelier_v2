'use client';
// Formulaire du back-office qui enregistre sans recharger la page : l'action renvoie { ok } ou { erreur },
// le serveur ne recalcule que ce qui a changé (revalidatePath) et la page garde sa position.
// Un petit message confirme l'enregistrement en bas de l'écran.
import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

export type Retour = { ok?: string; erreur?: string } | void;

export function FormulaireAdmin({ action, children, className, style, id }: {
  action: (f: FormData) => Promise<Retour>; children: ReactNode; className?: string; style?: CSSProperties; id?: string;
}) {
  const [etat, envoyer] = useActionState(async (_: { r: Retour; n: number }, f: FormData) => ({ r: await action(f), n: Date.now() }), { r: undefined, n: 0 });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!etat.n) return;
    setVisible(true);
    if (etat.r?.erreur) return; // une erreur reste affichée jusqu'au prochain envoi
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, [etat]);
  return (
    <form action={envoyer} className={className} style={style} id={id}>
      {children}
      {visible && (
        <span role="status" aria-live="polite" className={`toast-admin ${etat.r?.erreur ? 'erreur' : ''}`} onClick={() => setVisible(false)}>
          {etat.r?.erreur ?? etat.r?.ok ?? 'Enregistré.'}
        </span>
      )}
    </form>
  );
}
