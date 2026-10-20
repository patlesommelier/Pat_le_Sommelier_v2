import { seDeconnecterApp } from './actions';
import { EnteteApp } from './Entete';
import { ConversationPat } from './ConversationPat';
import { exigerUtilisateurApp } from '@/lib/app/auth';
import s from './app.module.css';

/** Chez Pat : une fois connecté, Pat demande comment il peut aider ; l'utilisateur lui dit ce qu'il mange. */
export default async function ChezPat() {
  const u = await exigerUtilisateurApp();
  return (
    <>
      <EnteteApp><form action={seDeconnecterApp}><button className={s.lien}>Se déconnecter</button></form></EnteteApp>
      <ConversationPat prenom={u.prenom} />
    </>
  );
}
