import { redirect } from 'next/navigation';
import s from '../inscription.module.css';
import { Etapes, FormulaireAction } from '../composants';
import { creerCompte } from '../actions';
import { inscriptionCourante } from '@/lib/inscription/etat';

export default async function Compte() {
  const i = await inscriptionCourante();
  if (!i) redirect('/inscription');
  if (!i.couleur) redirect('/inscription/couleur');
  return (
    <main className={s.contenu}>
      <Etapes etape={5} />
      <h1 className={s.titre}>Votre compte</h1>
      <p className={s.texte}>Il vous donne accès à votre espace : menu, carte, accords et carte imprimable.</p>
      <div className={s.carte}>
        <strong>{i.plats.length} plats · {i.vins.length} vins</strong>
        <span className={s.texte} style={{ fontSize: 14 }}>Prêts à être analysés par Pat</span>
      </div>
      <FormulaireAction action={creerCompte} libelle="Créer mon compte" enCours="Création du compte…">
        <div className={s.champ}><label htmlFor="nom">Nom du restaurant</label><input id="nom" name="nom" required autoComplete="organization" /></div>
        <div className={s.champ}><label htmlFor="ville">Ville</label><input id="ville" name="ville" autoComplete="address-level2" /></div>
        <div className={s.champ}><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@restaurant.be" /></div>
        <div className={s.champ}><label htmlFor="motDePasse">Mot de passe</label><input id="motDePasse" name="motDePasse" type="password" required minLength={12} autoComplete="new-password" placeholder="12 caractères minimum" /></div>
        <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 44, fontSize: 14.5, cursor: 'pointer' }}>
          <input type="checkbox" name="cgu" required style={{ width: 22, height: 22, margin: '1px 0 0', accentColor: '#610420' }} />
          <span>J’accepte les <a href="/conditions" target="_blank">conditions d’utilisation</a></span>
        </label>
        <p className={s.texte} style={{ fontSize: 13, textAlign: 'center' }}>Nous vous enverrons un e-mail de confirmation.</p>
      </FormulaireAction>
    </main>
  );
}
