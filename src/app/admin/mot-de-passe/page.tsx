import { changerMotDePasse } from '../actions';
import { Message } from '@/components/admin/Ui';
import { exigerConnexion } from '@/lib/admin/auth';

export default async function MotDePasse({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const u = await exigerConnexion();
  const { erreur } = await searchParams;
  return (
    <div className="bo bo-connexion">
      <form action={changerMotDePasse} className="carte-bo sticker">
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Nouveau mot de passe</h1>
        <span className="discret">{u.email}</span>
        <Message erreur={erreur} />
        <div className="champ"><label htmlFor="mdp">Mot de passe</label><input id="mdp" name="mdp" type="password" required minLength={10} autoComplete="new-password" /><span className="aide">10 caractères minimum</span></div>
        <div className="champ"><label htmlFor="mdp2">Confirmer</label><input id="mdp2" name="mdp2" type="password" required autoComplete="new-password" /></div>
        <button type="submit" className="btn">Enregistrer</button>
      </form>
    </div>
  );
}
