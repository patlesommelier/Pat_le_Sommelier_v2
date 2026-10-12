'use client';
// Carte des vins du restaurant : catégories spéciales de l'app (coups de cœur, nature, bio, au verre), cochées ici.
// Chaque case s'applique tout de suite (un vin d'une catégorie cochée n'apparaît plus que là, plus dans sa couleur).
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const CASES = [
  ['coups_de_coeur', 'Coups de cœur', 'Les vins cochés « Coup de cœur » dans leur fiche'],
  ['nature', 'Nature', 'Les vins nature, d’après la base de Pat'],
  ['bio', 'Bio', 'Les vins bio, d’après la base de Pat'],
  ['au_verre', 'Au verre', 'Les vins servis au verre'],
] as const;

export function CasesCategories({ choisies: initiales, enregistrer }: { choisies: string[]; enregistrer: (categories: string[]) => Promise<{ ok: boolean }> }) {
  const router = useRouter();
  const [choisies, setChoisies] = useState(initiales);
  const [enCours, demarrer] = useTransition();
  const basculer = (id: string, oui: boolean) => {
    const nouvelles = CASES.map(([k]) => k as string).filter((k) => (k === id ? oui : choisies.includes(k)));
    setChoisies(nouvelles);
    demarrer(async () => { await enregistrer(nouvelles); router.refresh(); });
  };
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center', opacity: enCours ? 0.6 : 1 }}
      title="Catégories en plus des couleurs dans l’app : un vin d’une catégorie cochée n’apparaît que là (s’il est dans plusieurs, la première compte)">
      <span className="petit discret">Catégories en plus :</span>
      {CASES.map(([id, libelle, aide]) => (
        <label key={id} title={aide} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={choisies.includes(id)} disabled={enCours} onChange={(e) => basculer(id, e.target.checked)} />
          {libelle}
        </label>
      ))}
    </div>
  );
}
