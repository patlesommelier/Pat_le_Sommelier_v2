import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Coque } from './Coque';
import { Entete } from '@/components/admin/Ui';
import { adminsConfigures, exigerConnexion } from '@/lib/admin/auth';
import { listeRestaurants } from '@/lib/admin/donnees';

export default async function AccueilAdmin() {
  const u = await exigerConnexion();
  const restos = (await listeRestaurants()).filter((r) => u.admin || u.restaurants.includes(r.id));
  if (!u.admin && restos.length === 1) redirect(`/admin/${restos[0].id}`);
  return (
    <Coque utilisateur={u} etapes={[]}>
      <Entete titre="Bonjour" texte={restos.length ? 'Choisissez un restaurant.' : 'Aucun restaurant n’est encore relié à votre compte. Demandez à Pat de vous donner accès.'} />
      {!restos.length && (
        <div className="carte-bo pile" style={{ maxWidth: 640 }}>
          <span>Connecté avec <b>{u.email}</b>.</span>
          <span className="discret">{adminsConfigures()
            ? `Cette adresse ne fait pas partie des administrateurs (PAT_ADMIN_EMAILS en compte ${adminsConfigures()}).`
            : 'Aucun administrateur n’est configuré : la variable PAT_ADMIN_EMAILS n’est pas lue par le site.'}</span>
        </div>
      )}
      <div className="grille">
        {restos.map((r) => (
          <Link key={r.id} href={`/admin/${r.id}`} className="carte-bo" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: r.couleur, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }}>{r.nom.slice(0, 1)}</span>
            <span><h2 style={{ fontSize: 20 }}>{r.nom}</h2><span className="discret">{r.plats} plats · {r.vins} vins</span></span>
          </Link>
        ))}
      </div>
    </Coque>
  );
}
