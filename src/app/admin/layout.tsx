import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = { title: 'Pat le sommelier — espace restaurant', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@700&display=swap" precedence="default" />
      {children}
    </>
  );
}
