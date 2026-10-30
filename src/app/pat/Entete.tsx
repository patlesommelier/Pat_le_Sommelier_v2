import Link from 'next/link';
import s from './app.module.css';

/** En-tête de l'App : le logo de Pat à gauche, une action à droite. */
export function EnteteApp({ children }: { children?: React.ReactNode }) {
  return (
    <header className={`${s.large} ${s.entete}`}>
      <Link href="/pat" aria-label="Pat le sommelier">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat-logo-rouge.svg" alt="Pat le sommelier" width={74} height={48} />
      </Link>
      {children}
    </header>
  );
}

