// Super-admin — « + Ajouter un restaurant » : les informations de base ; le responsable reçoit une invitation.
import Link from 'next/link';
import { creerRestaurant } from '../../actions';
import { Entete, Message } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { indicateurs } from '@/lib/super/donnees';

export default async function NouveauRestaurant({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  await exigerAdmin();
  const [sp, ind] = await Promise.all([searchParams, indicateurs()]);
  return (
    <>
      <Entete titre="Ajouter un restaurant" texte="Les informations de base : le reste (menu, carte des vins, apparence…) se règle ensuite dans l’espace du restaurant.">
        <Link href="/admin/super" className="btn fantome">← Restaurants</Link>
      </Entete>
      <Message erreur={sp.erreur} />
      <form action={creerRestaurant} className="carte-bo pile" style={{ maxWidth: 640 }}>
        <div className="champ"><label htmlFor="nom">Nom du restaurant</label><input id="nom" name="nom" required /></div>
        <div className="champ"><label htmlFor="email">E-mail du responsable</label><input id="email" name="email" type="email" required />
          <span className="aide">Il reçoit une invitation pour choisir son mot de passe et accéder à l’espace de son restaurant.</span></div>
        <div className="champ"><label htmlFor="ville">Ville</label><input id="ville" name="ville" /></div>
        <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, marginBottom: 6 }}>Langues</legend>
          <div style={{ display: 'flex', gap: 16 }}>
            {[['fr', 'Français'], ['nl', 'Nederlands'], ['en', 'English']].map(([k, l]) => (
              <label key={k} className="case"><input type="checkbox" name={`langue_${k}`} defaultChecked={k === 'fr'} /><span>{l}</span></label>))}
          </div>
        </fieldset>
        <div className="champ"><label htmlFor="couleur">Couleur</label><input id="couleur" name="couleur" type="color" defaultValue="#680021" style={{ width: 80, height: 40 }} /></div>
        <p className="discret" style={{ margin: 0 }}>Règles de départ : celles de Pat en service ({ind.regles ?? 'V7'}) ; le restaurant pourra les ajuster.</p>
        <span><button className="btn rouge">Créer et inviter</button></span>
      </form>
    </>
  );
}
