import { Icone } from './Icone';

export function Entete({ titre, texte, children }: { titre: string; texte?: string; children?: React.ReactNode }) {
  return (
    <header className="bo-entete">
      <div><h1>{titre}</h1>{texte && <p>{texte}</p>}</div>
      {children && <div className="ligne-actions">{children}</div>}
    </header>
  );
}

export function Etat({ type = '', children }: { type?: 'ok' | 'propose' | 'attention' | 'defaut' | 'modifie' | ''; children: React.ReactNode }) {
  return <span className={`etat ${type}`}>{children}</span>;
}

export function Points({ note }: { note: number }) {
  return (
    <span className="points" role="img" aria-label={`Note ${note} sur 5`}>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < note ? 'plein' : ''} />)}
    </span>
  );
}

export function Vignette({ url, taille = 52 }: { url: string | null; taille?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img className="vignette" src={url} alt="" style={{ width: taille, height: taille }} />;
  return <span className="vignette vide" style={{ width: taille, height: taille }} aria-hidden="true"><Icone nom="bottle" taille={22} /></span>;
}

export function Message({ ok, erreur }: { ok?: string; erreur?: string }) {
  if (erreur) return <p className="message erreur" role="alert">{erreur}</p>;
  if (ok) return <p className="message ok" role="status">{ok}</p>;
  return null;
}

export const euros = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('fr-BE', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
