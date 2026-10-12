'use client';
// Carte des vins du restaurant : chaque ligne de vin se prend à la souris et se dépose au-dessus d'un autre vin
// (ou sur le titre d'une sous-catégorie, pour la mettre en tête). L'ordre est enregistré tout de suite, comme dans l'app.
// Les cellules sont rendues par le serveur ; ce composant ne gère que l'ordre et le glisser-déposer.
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

export type LigneGlissable = { cle: string; ids: string[]; cellules: ReactNode; classe?: string; ancre?: string };
export type RubriqueGlissable = { cle: string; nom: string; entete: ReactNode; vins: LigneGlissable[] };
type Plan = { rubrique: string; vins: string[][] }[];

export function TableCarteGlissable({ rubriques: initiales, enregistrer, fixe = false }: { rubriques: RubriqueGlissable[]; enregistrer?: (plan: Plan) => Promise<{ ok: boolean }>; fixe?: boolean }) {
  const router = useRouter();
  const [rubriques, setRubriques] = useState(initiales);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [cible, setCible] = useState<string | null>(null); // ligne (ou titre « r:… ») au-dessus de laquelle on dépose
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  useEffect(() => setRubriques(initiales), [initiales]); // nouvelle version du serveur (après enregistrement)

  const deposer = (cle: string, rubrique: number, avant: string | null) => {
    if (cle === avant || fixe || !enregistrer) return;
    const r = rubriques.map((x) => ({ ...x, vins: [...x.vins] }));
    let vin: LigneGlissable | undefined;
    for (const x of r) { const j = x.vins.findIndex((v) => v.cle === cle); if (j >= 0) [vin] = x.vins.splice(j, 1); }
    if (!vin) return;
    const j = avant ? r[rubrique].vins.findIndex((v) => v.cle === avant) : 0; // sur le titre : en tête de la sous-catégorie
    r[rubrique].vins.splice(j >= 0 ? j : r[rubrique].vins.length, 0, vin);
    setRubriques(r);
    demarrer(async () => {
      const res = await enregistrer(r.map((x) => ({ rubrique: x.nom, vins: x.vins.map((v) => v.ids) })));
      setMessage(res.ok ? 'Ordre enregistré : l’app est à jour.' : 'Échec : rien n’a été enregistré.');
      router.refresh();
    });
  };
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 2500); return () => clearTimeout(t); }, [message]);

  const survol = (id: string) => (e: React.DragEvent) => { if (!glisse) return; e.preventDefault(); if (cible !== id) setCible(id); };
  const fin = () => { setGlisse(null); setCible(null); };
  const trait = (id: string) => (cible === id && glisse ? { boxShadow: 'inset 0 3px 0 var(--bordeaux, #6b0f24)' } : undefined);

  return (
    <>
      {rubriques.map((r, ri) => (
        <tbody key={r.cle}>
          <tr className="rubrique-carte" onDragOver={survol(`r:${r.cle}`)} onDragLeave={() => setCible(null)}
            onDrop={(e) => { e.preventDefault(); if (glisse) deposer(glisse, ri, null); fin(); }} style={trait(`r:${r.cle}`)}>
            {r.entete}
          </tr>
          {r.vins.map((v) => (
            <tr key={v.cle} id={v.ancre} className={v.classe} draggable={!fixe}
              onDragStart={(e) => { setGlisse(v.cle); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={fin}
              onDragOver={survol(v.cle)} onDrop={(e) => { e.preventDefault(); if (glisse) deposer(glisse, ri, v.cle); fin(); }}
              style={{ scrollMarginTop: 80, cursor: fixe ? undefined : 'grab', opacity: glisse === v.cle ? 0.4 : enCours ? 0.8 : 1, ...trait(v.cle) }}
              title={fixe ? undefined : 'Glissez la ligne pour déplacer ce vin'}>
              {v.cellules}
            </tr>
          ))}
        </tbody>
      ))}
      {message && <tbody><tr><td colSpan={8} style={{ padding: 0, border: 0 }}><span role="status" className="toast-admin">{message}</span></td></tr></tbody>}
    </>
  );
}
