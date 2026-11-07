'use client';
// Adresse du restaurant (Paramètres) vérifiée avec OpenStreetMap : au fil de la frappe, des propositions d'adresses ;
// en choisir une la marque « vérifiée » et enregistre sa position (petite carte en dessous). Une adresse tapée à la main
// reste possible (OpenStreetMap ne connaît pas toutes les adresses) : elle est simplement signalée « non vérifiée ».
import { useEffect, useRef, useState } from 'react';

interface Proposition { texte: string; ligne1: string; ligne2: string; pays: string; lat: number; lon: number }

export function ChampAdresse({ resto, valeur, lat, lon }: { resto: string; valeur: string | null; lat: number | null; lon: number | null }) {
  const [texte, setTexte] = useState(valeur ?? '');
  const [position, setPosition] = useState(lat != null && lon != null ? { lat, lon } : null);
  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [actif, setActif] = useState(-1);
  const tape = useRef(false); // texte changé au clavier (pas en choisissant une proposition)

  // Recherche 400 ms après la dernière frappe.
  useEffect(() => {
    if (!tape.current) return;
    const q = texte.replace(/\s+/g, ' ').trim();
    if (q.length < 4) { setPropositions([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setRecherche(true);
      try {
        const r = await fetch(`/api/restaurants/${resto}/adresse?${new URLSearchParams({ q })}`, { signal: ctrl.signal, cache: 'no-store' });
        const l = r.ok ? (await r.json() as Proposition[]) : [];
        setPropositions(l); setActif(-1); setOuvert(true);
      } catch { /* recherche remplacée ou service indisponible */ }
      setRecherche(false);
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [texte, resto]);

  const choisir = (p: Proposition) => {
    tape.current = false;
    setTexte(p.texte); setPosition({ lat: p.lat, lon: p.lon }); setOuvert(false); setPropositions([]);
  };

  const d = 0.004;
  const carte = position && `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({
    bbox: [position.lon - d, position.lat - d / 2, position.lon + d, position.lat + d / 2].join(','), layer: 'mapnik', marker: `${position.lat},${position.lon}` })}`;

  return (
    <div className="champ champ-adresse" style={{ gridColumn: '1 / -1' }}>
      <label htmlFor="commande_adresse">Adresse du restaurant (livraison)</label>
      <div style={{ position: 'relative' }}>
        <textarea id="commande_adresse" name="commande_adresse" rows={2} value={texte} autoComplete="off" style={{ width: '100%' }}
          role="combobox" aria-expanded={ouvert && propositions.length > 0} aria-controls="propositions-adresse" aria-autocomplete="list"
          placeholder="Commencez à taper : rue, numéro, ville…"
          onChange={(e) => { tape.current = true; setTexte(e.target.value); setPosition(null); }}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
          onKeyDown={(e) => {
            if (!ouvert || !propositions.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActif((i) => (i + 1) % propositions.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((i) => (i <= 0 ? propositions.length : i) - 1); }
            else if (e.key === 'Enter' && actif >= 0) { e.preventDefault(); choisir(propositions[actif]); }
            else if (e.key === 'Escape') setOuvert(false);
          }} />
        {ouvert && tape.current && texte.trim().length >= 4 && !recherche && (
          <ul id="propositions-adresse" role="listbox" className="propositions-adresse">
            {propositions.map((p, i) => (
              <li key={p.texte} role="option" aria-selected={i === actif} onMouseDown={(e) => { e.preventDefault(); choisir(p); }}>
                <b>{p.ligne1}</b><span>{[p.ligne2, p.pays].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
            {!propositions.length && <li className="vide">Aucune adresse trouvée : vérifiez l’orthographe, ou gardez votre adresse telle quelle.</li>}
          </ul>
        )}
      </div>
      <input type="hidden" name="adresse_lat" value={position?.lat ?? ''} />
      <input type="hidden" name="adresse_lon" value={position?.lon ?? ''} />
      {position ? (
        <span className="adresse-etat ok">✓ Adresse vérifiée sur OpenStreetMap</span>
      ) : texte.trim() ? (
        <span className="adresse-etat attention">{recherche ? 'Recherche de l’adresse…' : 'Adresse non vérifiée : choisissez-la dans les propositions qui s’affichent pendant la frappe.'}</span>
      ) : null}
      {carte && <iframe title="Position du restaurant" src={carte} className="carte-adresse" loading="lazy" />}
    </div>
  );
}
