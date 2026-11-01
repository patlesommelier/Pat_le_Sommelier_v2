import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = { title: 'Quid Vinum — espace restaurant', robots: { index: false, follow: false }, icons: { icon: '/quidvinum/icone.png', apple: '/quidvinum/icone.png' } };
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" precedence="default" />
      {children}
    </>
  );
}
