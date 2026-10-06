'use client';
// Super-admin, page Menu : envoyer le menu pour que Pat en relise les prix (plats et accords inchangés).
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PatAttente } from '@/components/PatAttente';
import { relirePrixMenu } from '@/app/admin/super/actions';
import { reduire } from '@/lib/reduire-image';

type Derniere = { statut: string; message: string | null; le: string } | null;

export function RelirePrix({ resto, derniere }: { resto: string; derniere: Derniere }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [envoi, demarrer] = useTransition();
  const enCours = envoi || derniere?.statut === 'en_attente' || derniere?.statut === 'en_cours';
  // Lecture en arrière-plan : la page se recharge toutes les 5 secondes jusqu'au résultat.
  useEffect(() => {
    if (!enCours || envoi) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [enCours, envoi, router]);

  const envoyer = (liste: FileList | null) => {
    if (!liste?.length) return;
    demarrer(async () => {
      const fd = new FormData();
      (await Promise.all([...liste].map(reduire))).forEach((f) => fd.append('fichiers', f));
      const r = await relirePrixMenu(resto, fd);
      setErreurs(r.erreurs);
      if (input.current) input.current.value = '';
      router.refresh();
    });
  };

  return (
    <div className="carte-bo pile interne" style={{ gap: 8, marginBottom: 16 }}>
      <b>Relire les prix sur le menu</b>
      <span className="petit discret">Super-admin. Envoyez les pages du menu (photos ou PDF) : Pat retrouve chaque plat par son nom et remplit son prix. Les plats, descriptions et accords ne changent pas.</span>
      {enCours ? (
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><PatAttente taille={40} />Pat lit les prix du menu…</div>
      ) : (
        <div>
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" id="menu-prix"
            style={{ display: 'none' }} onChange={(e) => envoyer(e.currentTarget.files)} />
          <label htmlFor="menu-prix" className="btn sec petit" style={{ cursor: 'pointer' }}>Envoyer le menu</label>
        </div>
      )}
      {erreurs.length > 0 && <ul className="message erreur" role="alert" style={{ margin: 0 }}>{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>}
      {!enCours && derniere?.message && (
        <span className="petit" style={{ color: derniere.statut === 'erreur' ? 'var(--ocre)' : undefined }}>
          Dernière relecture ({new Date(derniere.le).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })}) : {derniere.message}
        </span>
      )}
    </div>
  );
}
