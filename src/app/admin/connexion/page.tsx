import { redirect } from 'next/navigation';
import { motDePasseOublie, seConnecter } from '../actions';
import { Message } from '@/components/admin/Ui';
import { utilisateurCourant } from '@/lib/admin/auth';
import { supabaseConfigure } from '@/lib/admin/supabase';

export default async function Connexion({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string; oubli?: string }> }) {
  if (await utilisateurCourant()) redirect('/admin');
  const { erreur, info, oubli } = await searchParams;
  return (
    <div className="bo bo-connexion">
      <div className="carte-bo sticker">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pat/pat.png" alt="" width={54} height={59} />
          <div><h1 style={{ fontSize: 26, fontWeight: 800 }}>Pat le sommelier</h1><span className="discret">Espace restaurant</span></div>
        </div>
        {!supabaseConfigure() && <Message erreur="Connexion indisponible : Supabase n’est pas configuré (NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY)." />}
        <Message erreur={erreur} ok={info} />
        {oubli ? (
          <form action={motDePasseOublie} className="pile">
            <div className="champ"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
            <button type="submit" className="btn">Recevoir un lien</button>
            <a href="/admin/connexion" className="discret">Revenir à la connexion</a>
          </form>
        ) : (
          <form action={seConnecter} className="pile">
            <div className="champ"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
            <div className="champ"><label htmlFor="mdp">Mot de passe</label><input id="mdp" name="mdp" type="password" required autoComplete="current-password" /></div>
            <button type="submit" className="btn">Se connecter</button>
            <a href="/admin/connexion?oubli=1" className="discret">Mot de passe oublié ?</a>
          </form>
        )}
        <p className="discret" style={{ margin: 0, fontSize: 14 }}>Pas encore de compte ? <a href="/inscription">Inscrire mon restaurant</a></p>
      </div>
    </div>
  );
}
