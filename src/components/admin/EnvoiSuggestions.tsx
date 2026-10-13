'use client';
// Menu du restaurant : envoyer une photo (ou un PDF) des suggestions du moment. Les photos sont réduites dans le navigateur
// avant l'envoi ; Pat lit les plats en arrière-plan (la page se met à jour toute seule pendant la lecture).
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { reduire } from '@/lib/reduire-image';

type Retour = { ok?: string; erreur?: string } | void;
export type EtatLecture = { statut: string; message: string | null; le: string } | null;

export function EnvoiSuggestions({ envoyer, derniere, nombre }: { envoyer: (f: FormData) => Promise<Retour>; derniere: EtatLecture; nombre: number }) {
  const router = useRouter();
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [remplacer, setRemplacer] = useState(true);
  const [retour, setRetour] = useState<Retour>();
  const [enCours, demarrer] = useTransition();
  const lecture = derniere && (derniere.statut === 'a_lire' || derniere.statut === 'en_cours');
  // Pendant la lecture : la page se met à jour toutes les 4 secondes.
  useEffect(() => { if (!lecture) return; const t = setInterval(() => router.refresh(), 4000); return () => clearInterval(t); }, [lecture, router]);

  const valider = () => demarrer(async () => {
    const f = new FormData();
    for (const x of await Promise.all(fichiers.map(reduire))) f.append('suggestions', x);
    if (remplacer) f.append('remplacer', 'on');
    const r = await envoyer(f);
    setRetour(r);
    if (r && !r.erreur) setFichiers([]);
    router.refresh();
  });

  return (
    <section className="carte-bo pile" style={{ gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>Suggestions du moment</h2>
        <span className="petit discret">{nombre ? `${nombre} suggestion${nombre > 1 ? 's' : ''} en ce moment` : 'Aucune suggestion en ce moment'}</span>
      </div>
      <p className="discret" style={{ margin: 0 }}>Envoyez une photo de votre ardoise ou de vos suggestions : Pat lit les plats, les ajoute dans « Suggestions » (en tête du menu de l’app) et prépare leurs accords.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn sec" style={{ cursor: 'pointer' }}>
          {fichiers.length ? `${fichiers.length} fichier${fichiers.length > 1 ? 's' : ''} choisi${fichiers.length > 1 ? 's' : ''}` : 'Choisir une photo ou un PDF'}
          <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => setFichiers([...(e.target.files ?? [])])} />
        </label>
        <label className="case" style={{ margin: 0 }}>
          <input type="checkbox" checked={remplacer} onChange={(e) => setRemplacer(e.target.checked)} />
          <span>Remplacer les suggestions actuelles<small>Décochez pour les ajouter à celles déjà en ligne.</small></span>
        </label>
        <button type="button" className="btn" disabled={!fichiers.length || enCours || Boolean(lecture)} onClick={valider}>{enCours ? 'Envoi…' : 'Envoyer à Pat'}</button>
      </div>
      {retour?.erreur && <p className="message erreur" style={{ margin: 0 }}>{retour.erreur}</p>}
      {lecture && <p className="message" style={{ margin: 0 }}>Pat lit vos suggestions… (la page se met à jour toute seule)</p>}
      {!lecture && derniere?.statut === 'ok' && <p className="message ok" style={{ margin: 0 }}>{derniere.message} Pat prépare leurs accords : elles apparaîtront dans l’app dans quelques minutes.</p>}
      {!lecture && derniere?.statut === 'erreur' && <p className="message erreur" style={{ margin: 0 }}>{derniere.message}</p>}
    </section>
  );
}
