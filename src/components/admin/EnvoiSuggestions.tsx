'use client';
// Menu du restaurant : envoyer une photo (ou un PDF) des suggestions du moment, ou renvoyer le menu complet. Les photos sont réduites dans le navigateur
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
  const [toutEffacer, setToutEffacer] = useState(false);
  const [retour, setRetour] = useState<Retour>();
  const [enCours, demarrer] = useTransition();
  const lecture = derniere && (derniere.statut === 'a_lire' || derniere.statut === 'en_cours');
  // Pendant la lecture : la page se met à jour toutes les 4 secondes.
  useEffect(() => { if (!lecture) return; const t = setInterval(() => router.refresh(), 4000); return () => clearInterval(t); }, [lecture, router]);

  const valider = (liste = fichiers, menu = false) => demarrer(async () => {
    const f = new FormData();
    for (const x of await Promise.all(liste.map(reduire))) f.append('suggestions', x);
    if (menu ? toutEffacer : remplacer) f.append('remplacer', 'on');
    if (menu) f.append('menu', 'on');
    const r = await envoyer(f);
    setRetour(r);
    if (r && !r.erreur) setFichiers([]);
    router.refresh();
  });

  return (
    <section className="carte-bo pile" style={{ gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>Envoyez vos suggestions ou votre menu</h2>
        <span className="petit discret">{nombre ? `${nombre} suggestion${nombre > 1 ? 's' : ''} en ce moment` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn sec" style={{ cursor: 'pointer' }}>
          {fichiers.length ? `${fichiers.length} fichier${fichiers.length > 1 ? 's' : ''} choisi${fichiers.length > 1 ? 's' : ''}` : 'Choisir une photo ou un PDF'}
          <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => setFichiers([...(e.target.files ?? [])])} />
        </label>
        {/* Envoi à Pat : bouton rond à côté du choix de la photo. */}
        <button type="button" className="btn" aria-label={enCours ? 'Envoi en cours' : 'Envoyer à Pat'} title="Envoyer à Pat"
          disabled={!fichiers.length || enCours || Boolean(lecture)} onClick={() => valider()}
          style={{ width: 44, height: 44, padding: 0, justifyContent: 'center', borderRadius: '50%', marginLeft: -4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
        </button>
        <label className="case" style={{ margin: 0 }}>
          <input type="checkbox" checked={remplacer} onChange={(e) => setRemplacer(e.target.checked)} />
          <span>Remplacer les suggestions actuelles</span>
        </label>
        {/* Menu complet : à droite des suggestions. Sans « Tout effacer », les plats connus gardent leurs accords. */}
        <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          <label className="btn sec" style={{ cursor: enCours || lecture ? 'default' : 'pointer', opacity: enCours || lecture ? 0.5 : 1 }}
            title="Envoyez une photo ou le PDF de votre menu : Pat ajoute les nouveaux plats et met à jour les prix.">
            Renvoyer le menu
            <input type="file" accept="image/*,application/pdf" multiple hidden disabled={enCours || Boolean(lecture)} onChange={(e) => {
              const liste = [...(e.target.files ?? [])];
              e.target.value = '';
              if (!liste.length) return;
              if (toutEffacer && !confirm('Tous les plats actuels du menu (hors suggestions) seront effacés, avec leurs accords, et remplacés par ceux de ce menu. Continuer ?')) return;
              valider(liste, true);
            }} />
          </label>
          <label className="case" style={{ margin: 0 }}>
            <input type="checkbox" checked={toutEffacer} onChange={(e) => setToutEffacer(e.target.checked)} />
            <span>Tout effacer</span>
          </label>
        </span>
      </div>
      {retour?.erreur && <p className="message erreur" style={{ margin: 0 }}>{retour.erreur}</p>}
      {lecture && <p className="message" style={{ margin: 0 }}>Pat lit votre envoi… (la page se met à jour toute seule)</p>}
      {!lecture && derniere?.statut === 'ok' && <p className="message ok" style={{ margin: 0 }}>{derniere.message} Pat prépare les accords des nouveaux plats : ils apparaîtront dans l’app dans quelques minutes.</p>}
      {!lecture && derniere?.statut === 'erreur' && <p className="message erreur" style={{ margin: 0 }}>{derniere.message}</p>}
    </section>
  );
}
