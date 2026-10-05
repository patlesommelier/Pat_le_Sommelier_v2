'use client';
// Composants partagés des étapes d'inscription.
import { startTransition, useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import s from './inscription.module.css';
import type { EtatEnvoi } from './actions';

const NOMS = ['Menu', 'Vins', 'Logo', 'Couleur', 'Compte'];

export function Etapes({ etape }: { etape: number }) {
  return (
    <div className={s.etapes}>
      <span className={s.etapesLibelle}>Étape {etape} sur 5 · {NOMS[etape - 1]}</span>
      <div className={s.etapesBarre} role="progressbar" aria-label="Avancement" aria-valuemin={1} aria-valuemax={5} aria-valuenow={etape}>
        {NOMS.map((n, i) => <span key={n} data-fait={i < etape} />)}
      </div>
    </div>
  );
}

export function Erreurs({ erreurs }: { erreurs: string[] }) {
  if (!erreurs.length) return null;
  return <ul className={s.erreurs} role="alert">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>;
}

function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={s.bouton} disabled={pending} aria-busy={pending}>{pending ? enCours : libelle}</button>;
}

/**
 * Photo réduite dans le navigateur avant l'envoi (1800 px, JPEG) : envoi rapide sur mobile, et sous la limite de 6 Mo
 * par requête de Netlify. Un format que le navigateur ne sait pas décoder (HEIC sur Chrome) est envoyé tel quel.
 */
async function reduire(f: File): Promise<File> {
  if (!f.type.startsWith('image/') || f.type === 'image/svg+xml') return f;
  try {
    const img = await createImageBitmap(f);
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * k); canvas.height = Math.round(img.height * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return blob && blob.size < f.size ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
  } catch {
    return f;
  }
}

/** Envoi de photos ou d'un PDF. Sur mobile, « Photographier » ouvre directement l'appareil photo. */
export function ZoneEnvoi({ action, accept, multiple = true, photo = true, enCours, reduireImages = true }: {
  action: (e: EtatEnvoi, f: FormData) => Promise<EtatEnvoi>; accept: string; multiple?: boolean; photo?: boolean; enCours: string; reduireImages?: boolean;
}) {
  const [etat, envoyer, enAttente] = useActionState(action, { erreurs: [] });
  const [choisis, setChoisis] = useState<File[]>([]);
  const [prepare, setPrepare] = useState(false);
  const router = useRouter();
  useEffect(() => { if (etat.ok) { setChoisis([]); router.refresh(); } }, [etat, router]);
  const choisir = async (liste: FileList | null) => {
    setPrepare(true);
    const fichiers = [...(liste ?? [])];
    setChoisis(reduireImages ? await Promise.all(fichiers.map(reduire)) : fichiers);
    setPrepare(false);
  };
  const soumettre = () => {
    const fd = new FormData();
    choisis.forEach((f) => fd.append('fichiers', f));
    startTransition(() => envoyer(fd));
  };
  return (
    <div className={s.carte}>
      <div className={s.zone}>
        {photo && (
          <label className={s.boutonSecondaire}>
            Photographier
            <input className={s.cacher} type="file" accept="image/*" capture="environment" multiple={multiple}
              onChange={(e) => choisir(e.currentTarget.files)} />
          </label>
        )}
        <label className={s.boutonSecondaire}>
          {photo ? 'Envoyer un fichier' : 'Choisir un fichier'}
          <input className={s.cacher} type="file" accept={accept} multiple={multiple} onChange={(e) => choisir(e.currentTarget.files)} />
        </label>
      </div>
      {prepare && <span className={s.texte} style={{ fontSize: 14 }}>Préparation des photos…</span>}
      {choisis.length > 0 && !prepare && (
        <button type="button" className={s.bouton} disabled={enAttente} aria-busy={enAttente} onClick={soumettre}>
          {enAttente ? enCours : `Envoyer ${choisis.length} fichier${choisis.length > 1 ? 's' : ''}`}
        </button>
      )}
      <Erreurs erreurs={etat.erreurs} />
    </div>
  );
}

/** Formulaire à une action serveur avec affichage des erreurs (couleur, compte). */
export function FormulaireAction({ action, children, libelle, enCours }: {
  action: (e: EtatEnvoi, f: FormData) => Promise<EtatEnvoi>; children: React.ReactNode; libelle: string; enCours: string;
}) {
  const [etat, envoyer] = useActionState(action, { erreurs: [] });
  return (
    <form action={envoyer} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {children}
      <Erreurs erreurs={etat.erreurs} />
      <div className={s.barreAction}><div><BoutonEnvoi libelle={libelle} enCours={enCours} /></div></div>
    </form>
  );
}
