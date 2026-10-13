// Conditions d'utilisation du service (lien de la case à cocher du formulaire d'inscription).
// ⚠️ Texte à fournir par Pat : cette page ne contient volontairement aucune clause inventée.
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Conditions d’utilisation — Pat le sommelier' };

export default function Conditions() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: '#241F20', background: '#EFEBE9', lineHeight: 1.6 }}>
      <p><Link href="/" style={{ color: '#680021', fontWeight: 700 }}>← Pat le sommelier</Link></p>
      <h1 style={{ fontSize: 32, margin: '16px 0' }}>Conditions d’utilisation</h1>
      <p>Les conditions d’utilisation du service Pat le sommelier sont en cours de finalisation.</p>
      <p>Pour toute question avant de vous inscrire, écrivez-nous : nous vous répondrons rapidement.</p>
    </main>
  );
}
