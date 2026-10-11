'use client';
// Régénération de tous les accords sans recharger la page (page Accords) :
// - BoutonRegenerer lance la régénération (action serveur) et prévient le suivi ;
// - SuiviRegeneration affiche l'avancement en interrogeant le serveur toutes les 5 secondes, puis rafraîchit
//   la page une seule fois quand tout est fini (notes et commentaires à jour).
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { PatAttente } from '@/components/PatAttente';

type Etat = { total: number; finis: number; termine: boolean } | null;
const EVENEMENT = 'pat:regeneration-lancee';

export function BoutonRegenerer({ action, className, title, children }: {
  action: () => Promise<{ ok?: string; erreur?: string } | void>; className?: string; title?: string; children: ReactNode;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={className} title={title} disabled={enCours} aria-busy={enCours}
        onClick={() => demarrer(async () => {
          const r = await action();
          setErreur(r?.erreur ?? null);
          if (!r?.erreur) window.dispatchEvent(new Event(EVENEMENT));
        })}>{children}</button>
      {erreur && <span className="petit" role="alert" style={{ color: 'var(--rouge, #B3261E)' }}>{erreur}</span>}
    </>
  );
}

export function SuiviRegeneration({ resto, initial }: { resto: string; initial: Etat }) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>(initial);
  const [suivi, setSuivi] = useState(Boolean(initial && !initial.termine));
  useEffect(() => {
    const lancer = () => setSuivi(true);
    window.addEventListener(EVENEMENT, lancer);
    return () => window.removeEventListener(EVENEMENT, lancer);
  }, []);
  useEffect(() => {
    if (!suivi) return;
    let fini = false;
    const lire = async () => {
      const e = await fetch(`/api/restaurants/${resto}/regeneration`, { cache: 'no-store' }).then((r) => r.json() as Promise<Etat>).catch(() => null);
      if (fini || !e) return;
      setEtat(e);
      if (e.termine) { fini = true; setSuivi(false); router.refresh(); } // une seule fois, à la fin
    };
    void lire();
    const t = setInterval(lire, 5000);
    return () => { fini = true; clearInterval(t); };
  }, [suivi, resto, router]);
  if (!suivi || !etat || etat.termine) return null;
  return (
    <div className="carte-bo" style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '16px 20px' }} aria-live="polite">
      <PatAttente taille={56} />
      <div className="pile" style={{ gap: 6 }}>
        <strong>Pat régénère les accords…</strong>
        <span className="discret">{`${etat.finis} plat${etat.finis > 1 ? 's' : ''} sur ${etat.total} · plusieurs plats à la fois ; la page se met à jour à la fin`}</span>
      </div>
    </div>
  );
}
