// Page d'accueil du site : présentation de Pat et inscription d'un restaurant (maquette « Page d'accueil · inscription »).
// Les apps des restaurants restent à leur adresse (/lola…), celle de leurs QR codes.
import type { Metadata } from 'next';
import { PageAccueil } from '@/components/accueil/PageAccueil';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pat le sommelier — Faites de votre carte des vins un atout',
  description: 'Votre sommelier virtuel : vos clients choisissent leur plat, Pat leur propose des vins de votre carte et explique pourquoi. Prêt en quelques minutes.',
};

export default function Page() {
  return <PageAccueil />;
}
