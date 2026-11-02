'use client';
// Formulaire du back-office qui enregistre sans recharger la page : l'action renvoie { ok } ou { erreur },
// le serveur ne recalcule que ce qui a changé (revalidatePath) et la page garde sa position.
// Un petit message confirme l'enregistrement en bas de l'écran.
import { useActionState, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type Retour = { ok?: string; erreur?: string } | void;

export function FormulaireAdmin({ action, children, className, style, id, auto = false }: {
  action: (f: FormData) => Promise<Retour>; children: ReactNode; className?: string; style?: CSSProperties; id?: string;
  /** Enregistrement automatique : chaque champ nommé changé (en quittant le champ, ou au choix dans une liste) envoie le formulaire. */
  auto?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const f = ref.current;
    if (!auto || !f) return;
    const changer = (e: Event) => {
      const champ = e.target as HTMLInputElement | HTMLSelectElement;
      if (!champ.name || champ.form !== f) return; // champs sans nom (panier…) : pas pour ce formulaire
      if (champ instanceof HTMLSelectElement && champ.value === 'nouveau') return; // nouveau distributeur : attendre son nom
      f.requestSubmit();
    };
    f.addEventListener('change', changer);
    return () => f.removeEventListener('change', changer);
  }, [auto]);
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
    <form ref={ref} action={envoyer} className={className} style={style} id={id}>
      {children}
      {visible && (
        <span role="status" aria-live="polite" className={`toast-admin ${etat.r?.erreur ? 'erreur' : ''}`} onClick={() => setVisible(false)}>
          {etat.r?.erreur ?? etat.r?.ok ?? 'Enregistré.'}
        </span>
      )}
    </form>
  );
}
