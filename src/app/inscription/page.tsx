import Link from 'next/link';
import s from './inscription.module.css';
import { commencer } from './actions';

const ETAPES = [['Votre menu', 'Une photo ou un PDF'], ['Votre carte des vins', 'Une photo ou un PDF'],
  ['Votre logo', 'Pour l’en-tête de l’app'], ['Votre couleur', 'Tirée de votre logo'], ['Votre compte', 'Un e-mail et un mot de passe']];

export default async function Accueil({ searchParams }: { searchParams: Promise<{ limite?: string; erreur?: string }> }) {
  const { limite, erreur } = await searchParams;
  return (
    <form action={commencer} style={{ display: 'contents' }}>
      <main className={s.contenu}>
        <h1 className={s.titre} style={{ fontSize: 32 }}>Un sommelier à chaque table, en 10 minutes</h1>
        <p className={s.texte}>Photographiez votre menu et votre carte des vins. Pat prépare les accords de chaque plat, puis vous recevez le QR code à poser sur vos tables.</p>
        {limite && <p className={s.alerte}>Trop d’inscriptions depuis cette connexion aujourd’hui. Réessayez demain ou contactez-nous.</p>}
        {erreur && <p className={s.alerte}>Ce lien de confirmation n’est plus valable. Connectez-vous ou recommencez l’inscription.</p>}
        <ol className={s.liste}>
          {ETAPES.map(([t, d], i) => (
            <li key={t} style={{ justifyContent: 'flex-start', gap: 14, padding: '10px 0' }}>
              <strong aria-hidden="true" style={{ width: 28, color: '#610420' }}>{i + 1}</strong>
              <span><strong>{t}</strong><br /><span className={s.texte} style={{ fontSize: 14 }}>{d}</span></span>
            </li>
          ))}
        </ol>
        <p className={s.texte} style={{ fontSize: 14 }}>Vous avez déjà un compte ? <Link href="/admin/connexion">Se connecter</Link></p>
      </main>
      <div className={s.barreAction}><div><button type="submit" className={s.bouton}>Commencer</button></div></div>
    </form>
  );
}
