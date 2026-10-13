'use client';
// Menu de l'app : le client touche un ou plusieurs plats (ils se cochent), puis envoie pour voir les vins proposés.
// Plusieurs plats : Pat cherche les vins qui vont avec tous (règle « Plusieurs plats » : la note la plus basse compte).
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type PlatMenu = { id: string; nom: string; court: string };

export function ChoixPlats({ resto, groupes }: { resto: string; groupes: { titre: string; plats: PlatMenu[] }[] }) {
  const router = useRouter();
  const [choisis, setChoisis] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const basculer = (id: string) => setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const envoyer = () => {
    if (!choisis.length) return;
    setEnvoi(true);
    const [premier, ...autres] = choisis;
    router.push(`/${resto}/plat/${encodeURIComponent(premier)}${autres.length ? `?et=${autres.map(encodeURIComponent).join(',')}` : ''}`);
  };
  return (
    <>
      {groupes.map((g) => (
        <section key={g.titre} className="boite" aria-label={g.titre}>
          <div className="titre-section">
            <span>{g.titre}</span>
            <div className="filet court" />
          </div>
          <div className="bulles">
            {g.plats.map((p) => {
              const actif = choisis.includes(p.id);
              return (
                <button key={p.id} type="button" className={`bulle${actif ? ' choisie' : ''}`} title={p.nom} aria-pressed={actif} onClick={() => basculer(p.id)}>
                  {actif && <span aria-hidden="true" style={{ marginRight: 4 }}>✓</span>}{p.court}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {/* Le bouton n'apparaît qu'une fois un plat choisi : avant, toute la place va aux plats. */}
      {choisis.length > 0 && (
        <div className="envoi-plats">
          <button type="button" className="bouton-plein" disabled={envoi} onClick={envoyer}>
            {envoi ? 'Je cherche…' : choisis.length === 1 ? 'Trouver mon vin' : `Trouver un vin pour ces ${choisis.length} plats`}
          </button>
        </div>
      )}
    </>
  );
}
