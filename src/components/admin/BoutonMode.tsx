'use client';
// Statut de l'espace d'un restaurant (super-admin) : un interrupteur à trois positions — vert (actif), jaune (inscription),
// rouge (test). Un clic sur une position y amène le bouton et enregistre le statut.
import { useState, useTransition } from 'react';
import { changerModeRestaurant } from '@/app/admin/super/actions';
import { MODES, type ModeRestaurant } from '@/lib/admin/prochaine-etape';

const ORDRE: ModeRestaurant[] = ['actif', 'inscription', 'test'];

export function BoutonMode({ id, nom, mode }: { id: string; nom: string; mode: string }) {
  const [choisi, setChoisi] = useState<ModeRestaurant>(ORDRE.includes(mode as ModeRestaurant) ? mode as ModeRestaurant : 'actif');
  const [enCours, demarrer] = useTransition();
  const m = MODES[choisi];
  const choisir = (k: ModeRestaurant) => {
    if (k === choisi || enCours) return;
    setChoisi(k);
    demarrer(() => changerModeRestaurant(id, k));
  };
  return (
    <span className="mode-ligne">
      <span className="interrupteur-mode" role="radiogroup" aria-label={`Statut de ${nom}`} style={{ background: m.couleur }} data-occupe={enCours || undefined}>
        <span className="interrupteur-bouton" style={{ transform: `translateX(${ORDRE.indexOf(choisi) * 100}%)` }} aria-hidden="true" />
        {ORDRE.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={k === choisi} onClick={() => choisir(k)}
            title={`${MODES[k].libelle} : ${MODES[k].sens}`} aria-label={MODES[k].libelle} />
        ))}
      </span>
      <span className="petit"><b>{m.libelle}</b></span>
    </span>
  );
}
