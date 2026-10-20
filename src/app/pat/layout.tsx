import type { Metadata } from 'next';
import s from './app.module.css';

export const metadata: Metadata = { title: 'Pat le sommelier', description: 'Dis à Pat ce que tu manges : il te dit quel vin choisir, et pourquoi.' };

/** App consommateur de Pat le sommelier : mêmes couleurs et même typo que la page d'inscription des restaurants. */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return <div className={s.page}>{children}</div>;
}
