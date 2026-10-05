import { Aiguillage } from './aiguillage';

export const dynamic = 'force-dynamic';

// Arrivée depuis le lien de confirmation quand Supabase renvoie la session dans l'adresse (#access_token=…) :
// modèle d'e-mail par défaut, ou adresse de retour non autorisée (page d'accueil). Le fragment ne se lit que dans le navigateur.
export default async function Confirmation({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const { i } = await searchParams;
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#FFF', color: '#222' }}>
      <Aiguillage inscription={i && /^[0-9a-f-]{36}$/i.test(i) ? i : null} />
    </main>
  );
}
