'use client';
// Carte des vins (liste) : le prix d'une contenance, modifiable sur place ; enregistré en quittant le champ (ou Entrée).
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function ChampPrixVin({ libelle, nomVin, initial, enregistrer }: {
  libelle: string; nomVin: string; initial: number | null;
  enregistrer: (valeur: string) => Promise<{ ok: boolean; erreur?: string }>;
}) {
  const router = useRouter();
  const texte = (n: number | null) => n == null ? '' : n.toFixed(2).replace('.', ',');
  const [valeur, setValeur] = useState(texte(initial));
  const [enregistre, setEnregistre] = useState(texte(initial));
  const [etat, setEtat] = useState<'' | 'ok' | string>('');
  const [enCours, demarrer] = useTransition();
  const envoyer = () => {
    if (valeur.trim() === enregistre) return;
    demarrer(async () => {
      const r = await enregistrer(valeur);
      if (r.ok) {
        const n = valeur.trim() === '' ? null : Number(valeur.replace(/\s|€/g, '').replace(',', '.'));
        setValeur(texte(n)); setEnregistre(texte(n)); setEtat('ok'); router.refresh();
        setTimeout(() => setEtat(''), 1800);
      } else setEtat(r.erreur ?? 'Non enregistré');
    });
  };
  return (
    <label className="prix-carte" title={typeof etat === 'string' && etat && etat !== 'ok' ? etat : undefined}>
      <span>{libelle}</span>
      <span className="champ-prix">
        <input type="text" inputMode="decimal" value={valeur} placeholder="—" disabled={enCours}
          aria-label={`Prix ${libelle} : ${nomVin}`} aria-invalid={etat !== '' && etat !== 'ok' ? true : undefined}
          onChange={(e) => { setValeur(e.target.value); setEtat(''); }} onBlur={envoyer}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} /> €
      </span>
      {etat === 'ok' && <span className="prix-ok" aria-live="polite">✓</span>}
      {etat !== '' && etat !== 'ok' && <span className="prix-erreur" role="alert">{etat}</span>}
    </label>
  );
}
