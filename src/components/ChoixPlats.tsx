'use client';
// Menu de l'app : le client touche un ou plusieurs plats (ils se cochent), puis envoie pour voir les vins proposés.
// Plusieurs plats : Pat cherche les vins qui vont avec tous (règle « Plusieurs plats » : la note la plus basse compte).
// Design « Crème et courbes » : raccourcis vers chaque catégorie (avec le nombre de plats choisis) et cadre « Votre sélection »
// toujours visible en bas, pour retrouver les plats choisis dans les autres catégories.
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type PlatMenu = { id: string; nom: string; court: string };

export function ChoixPlats({ resto, groupes, creme = false }: { resto: string; groupes: { titre: string; plats: PlatMenu[] }[]; creme?: boolean }) {
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
  const libelle = envoi ? 'Je cherche…' : choisis.length === 1 ? 'Trouver mon vin' : `Trouver un vin pour ces ${choisis.length} plats`;
  const trouver = (id: string) => { for (const g of groupes) { const p = g.plats.find((x) => x.id === id); if (p) return { g, p }; } return null; };
  const ancre = (i: number) => `categorie-${i}`;
  return (
    <>
      {creme && groupes.length > 1 && (
        <nav className="raccourcis-plats" aria-label="Aller à une catégorie">
          {groupes.map((g, i) => {
            const n = g.plats.filter((p) => choisis.includes(p.id)).length;
            return (
              <a key={g.titre} href={`#${ancre(i)}`}>
                {g.titre}{n > 0 && <span className="compte" aria-label={`${n} choisi${n > 1 ? 's' : ''}`}>{n}</span>}
              </a>
            );
          })}
        </nav>
      )}
      {groupes.map((g, i) => (
        <section key={g.titre} id={ancre(i)} className="boite" aria-label={g.titre}>
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
      {choisis.length > 0 && (creme ? (
        <div className="envoi-plats">
          <section className="selection-plats" aria-label="Votre sélection">
            <div className="selection-haut">
              <b>Votre sélection</b>
              <button type="button" className="effacer" onClick={() => setChoisis([])}>Tout effacer</button>
            </div>
            <div className="selection-liste">
              {choisis.map((id) => {
                const t = trouver(id);
                if (!t) return null;
                return (
                  <button key={id} type="button" className="plat-choisi" onClick={() => basculer(id)} aria-label={`Retirer ${t.p.court}`}>
                    {groupes.length > 1 && <span className="categorie">{t.g.titre} ·</span>} {t.p.court}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                );
              })}
            </div>
            <button type="button" className="bouton-plein" disabled={envoi} onClick={envoyer}>{libelle}</button>
          </section>
        </div>
      ) : (
        <div className="envoi-plats">
          <button type="button" className="bouton-plein" disabled={envoi} onClick={envoyer}>{libelle}</button>
        </div>
      ))}
    </>
  );
}
