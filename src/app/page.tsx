// Page d'accueil du site (quidvinum.com) : présentation de la solution Quid Vinum et inscription d'un restaurant.
// Les apps des restaurants restent à leur adresse (/lola…), celle de leurs QR codes.
import type { Metadata } from 'next';
import { PageQuidVinum } from '@/components/accueil/PageQuidVinum';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quid Vinum — Développez et gérez l’offre vin de votre restaurant',
  description: 'Stock, commandes regroupées, carte des vins rédigée et imprimée, accords mets-vins et Pat le sommelier à chaque table. Gratuit, opérationnel en quelques minutes.',
  // Le Q de Quid Vinum dans l'onglet, comme dans l'espace restaurant (l'icône de Pat reste celle des apps des clients).
  icons: { icon: '/quidvinum/icone.png', apple: '/quidvinum/icone.png' },
};

export default function Page() {
  return <PageQuidVinum />;
}
