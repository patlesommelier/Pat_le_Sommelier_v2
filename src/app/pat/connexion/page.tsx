import Link from 'next/link';
import { redirect } from 'next/navigation';
import { motDePasseOublieApp, seConnecterApp } from '../actions';
import { EnteteApp } from '../Entete';
import { utilisateurApp } from '@/lib/app/auth';
import s from '../app.module.css';

/** Connexion à l'App : e-mail et mot de passe. */
export default async function ConnexionApp({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string; email?: string; oubli?: string }> }) {
  if (await utilisateurApp()) redirect('/pat');
  const { erreur, info, email, oubli } = await searchParams;
  return (
    <>
      <EnteteApp><Link href="/pat/inscription" className={s.lien}>Créer un compte</Link></EnteteApp>
      <main className={`${s.large} ${s.contenu}`}>
        <div className={s.accueil}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pat/pat-attable-rouge.svg" alt="Pat, le sommelier, attablé avec sa bouteille et son verre" width={560} height={440} />
          <h1 className={s.titre}>Quel vin avec ton plat&#8239;?</h1>
          <p className={s.sousTitre}>Dis à Pat ce que tu manges : il te dit quel vin choisir, et pourquoi.</p>
        </div>
        <section className={s.boite} aria-labelledby="h-connexion">
          <h2 id="h-connexion">{oubli ? 'Mot de passe oublié' : 'Se connecter'}</h2>
          {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
          {info && <p className={s.info} role="status">{info}</p>}
          {oubli ? (
            <form action={motDePasseOublieApp} className={s.formulaire}>
              <label className={s.champ}>Adresse e-mail<input name="email" type="email" required autoComplete="email" defaultValue={email} /></label>
              <button className={s.principal}>Recevoir un lien</button>
              <Link href="/pat/connexion" className={s.petitLien}>Revenir à la connexion</Link>
            </form>
          ) : <>
            <form action={seConnecterApp} className={s.formulaire}>
              <label className={s.champ}>Adresse e-mail<input name="email" type="email" required autoComplete="email" defaultValue={email} /></label>
              <label className={s.champ}>Mot de passe<input name="mdp" type="password" required autoComplete="current-password" /></label>
              <button className={s.principal}>Se connecter</button>
              <Link href="/pat/connexion?oubli=1" className={s.petitLien}>Mot de passe oublié&#8239;?</Link>
            </form>
          </>}
        </section>
        <p className={s.sousTitre} style={{ textAlign: 'center', alignSelf: 'center' }}>Pas encore de compte&#8239;? <Link href="/pat/inscription" className={s.lien}>Créer un compte</Link></p>
      </main>
    </>
  );
}
