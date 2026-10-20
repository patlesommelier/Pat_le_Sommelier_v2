import { changerMotDePasseApp } from '../actions';
import { EnteteApp } from '../Entete';
import { exigerUtilisateurApp } from '@/lib/app/auth';
import s from '../app.module.css';

/** Nouveau mot de passe, après le lien « mot de passe oublié ». */
export default async function MotDePasseApp({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  await exigerUtilisateurApp();
  const { erreur } = await searchParams;
  return (
    <>
      <EnteteApp />
      <main className={`${s.large} ${s.contenu}`}>
        <section className={s.boite}>
          <h2>Choisis un nouveau mot de passe</h2>
          {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
          <form action={changerMotDePasseApp} className={s.formulaire}>
            <label className={s.champ}>Nouveau mot de passe<input name="mdp" type="password" required minLength={10} autoComplete="new-password" /></label>
            <button className={s.principal}>Enregistrer</button>
          </form>
        </section>
      </main>
    </>
  );
}
