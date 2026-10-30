import Link from 'next/link';
import { redirect } from 'next/navigation';
import { creerCompteApp } from '../actions';
import { EnteteApp } from '../Entete';
import { utilisateurApp } from '@/lib/app/auth';
import s from '../app.module.css';

/** Création d'un compte de l'App : prénom, e-mail et mot de passe. */
export default async function InscriptionApp({ searchParams }: { searchParams: Promise<{ erreur?: string; prenom?: string; email?: string }> }) {
  if (await utilisateurApp()) redirect('/pat');
  const { erreur, prenom, email } = await searchParams;
  return (
    <>
      <EnteteApp><Link href="/pat/connexion" className={s.lien}>Se connecter</Link></EnteteApp>
      <main className={`${s.large} ${s.contenu}`}>
        <div className={s.accueil}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pat/pat-trinquer-bordeaux.svg" alt="" width={380} height={294} style={{ width: 'min(220px, 55vw)' }} />
          <h1 className={s.titre}>Ton sommelier, à chaque repas</h1>
          <p className={s.sousTitre}>Crée ton compte : Pat te conseille le vin qui va avec ce que tu manges, et t’explique pourquoi.</p>
        </div>
        <section className={s.boite} aria-labelledby="h-inscription">
          <h2 id="h-inscription">Créer mon compte</h2>
          {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
          <form action={creerCompteApp} className={s.formulaire}>
            <label className={s.champ}>Prénom<input name="prenom" required autoComplete="given-name" defaultValue={prenom} /></label>
            <label className={s.champ}>Adresse e-mail<input name="email" type="email" required autoComplete="email" defaultValue={email} /></label>
            <label className={s.champ}>Mot de passe<input name="mdp" type="password" required minLength={10} autoComplete="new-password" placeholder="10 caractères minimum" /></label>
            <button className={s.principal}>Créer mon compte</button>
          </form>
        </section>
      </main>
    </>
  );
}
