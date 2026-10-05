import type { Metadata } from 'next';
import s from './inscription.module.css';

export const metadata: Metadata = { title: 'Inscrire mon restaurant — Pat le sommelier', robots: { index: true, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Lato:wght@400;700&display=swap" />
      <header className={s.entete}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat.png" alt="" width={30} height={33} />
        <span className={s.marque}>Pat le sommelier</span>
      </header>
      {children}
    </div>
  );
}
