// Configuration d'un restaurant (super-admin) : ses distributeurs (les siens et ceux de Quid Vinum), et le verrou
// sur un seul distributeur Quid Vinum.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verrouillerDistributeurQv, voirCommeRestaurant } from '../../actions';
import { FormulaireVerrou } from '@/components/admin/FormulaireVerrou';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { getFournisseurs } from '@/lib/admin/stocks';
import { vinsSurCarteParDistributeur } from '@/lib/distributeurs/donnees';
import { requete } from '@/lib/db';

export default async function ConfigurationRestaurant({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [r] = await requete<{ id: string; nom: string; ville: string | null; statut: string; distributeur_qv_unique: string | null }>(
    'select id, nom, ville, statut, distributeur_qv_unique from restaurant where id = $1', [id]);
  if (!r) notFound();
  const [fournisseurs, surCarte, distributeurs] = await Promise.all([getFournisseurs(id), vinsSurCarteParDistributeur(id),
    requete<{ id: string; nom: string; actif: boolean; catalogue: number }>(
      `select d.id, d.nom, d.actif, (select count(*)::int from distributeur_vin v where v.distributeur_id = d.id and v.actif) as catalogue
         from distributeur d order by d.actif desc, lower(d.nom)`)]);
  const propres = fournisseurs.filter((f) => !f.distributeur_id);
  const choisi = (d: string) => fournisseurs.find((f) => f.distributeur_id === d) ?? null;
  const verrou = distributeurs.find((d) => d.id === r.distributeur_qv_unique) ?? null;
  // Quid Vinum : ceux qu'il a sélectionnés d'abord, puis ceux qui lui sont proposés ; les distributeurs masqués seulement s'il les avait choisis.
  const qv = distributeurs.filter((d) => d.actif || choisi(d.id)).sort((a, b) => Number(Boolean(choisi(b.id))) - Number(Boolean(choisi(a.id))));
  const marges = new Map((await requete<{ distributeur_id: string; marge: number | null }>(
    'select distributeur_id, marge::float8 as marge from fournisseur where restaurant_id = $1 and distributeur_id is not null', [id])).map((m) => [m.distributeur_id, m.marge]));

  return (
    <>
      <Entete titre={r.nom} texte={`Configuration du restaurant${r.ville ? ` · ${r.ville}` : ''}.`}>
        <Link href="/admin/super" className="btn fantome petit">← Restaurants</Link>
        <Link href={`/admin/${id}`} className="btn petit">Super-admin</Link>
        <form action={voirCommeRestaurant.bind(null, id)}><button className="btn sec petit">Vue restaurant</button></form>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />

      <section className="carte-bo pile">
        <div><h2 style={{ margin: 0 }}>Distributeur Quid Vinum unique</h2>
          <p className="sous" style={{ margin: '4px 0 0' }}>Verrouillé, le restaurant ne voit, ne cherche et ne commande que dans le catalogue de ce distributeur Quid Vinum.
            Ses propres distributeurs ne changent pas.</p></div>
        <p style={{ margin: 0 }}>{verrou ? <>Verrouillé sur <b>{verrou.nom}</b>.</> : 'Pas de verrou : tous les distributeurs Quid Vinum lui sont proposés.'}</p>
        <FormulaireVerrou action={verrouillerDistributeurQv.bind(null, id)} actuel={r.distributeur_qv_unique} restaurant={r.nom}
          distributeurs={distributeurs.filter((d) => d.actif).map((d) => ({ id: d.id, nom: d.nom, actif: Boolean(choisi(d.id)) }))} />
      </section>

      <section className="carte-bo pile">
        <h2 style={{ margin: 0 }}>Distributeurs Quid Vinum</h2>
        <div className="tableau">
          <table className="tableau-super">
            <thead><tr><th>Distributeur</th><th>Chez ce restaurant</th><th>Marge</th><th style={{ textAlign: 'right' }}>Vins sur la carte</th><th style={{ textAlign: 'right' }}>Catalogue</th></tr></thead>
            <tbody>
              {qv.map((d) => {
                const f = choisi(d.id);
                const bloque = Boolean(verrou && verrou.id !== d.id);
                return (
                  <tr key={d.id}>
                    <td><Link href={`/admin/super/distributeurs/${d.id}`}><b>{d.nom}</b></Link>{!d.actif && <> <Etat type="defaut">Masqué</Etat></>}</td>
                    <td>{bloque ? <Etat type="defaut">Exclu par le verrou</Etat> : f ? <Etat type="ok">Actif</Etat> : <span className="discret">Non sélectionné</span>}
                      {verrou?.id === d.id && <> <Etat type="propose">Unique</Etat></>}</td>
                    <td>{f ? (marges.get(d.id) != null ? `${marges.get(d.id)} %` : 'par défaut') : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{surCarte.get(d.id) ?? 0}</td>
                    <td style={{ textAlign: 'right' }} className="discret">{d.catalogue} vins</td>
                  </tr>
                );
              })}
              {!qv.length && <tr><td colSpan={5} className="discret">Aucun distributeur Quid Vinum pour le moment.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="petit discret" style={{ margin: 0 }}>La marge de ce restaurant se règle dans la fiche du distributeur, partie « Restaurants et marges ».</p>
      </section>

      <section className="carte-bo pile">
        <h2 style={{ margin: 0 }}>Distributeurs du restaurant</h2>
        <p className="sous" style={{ margin: 0 }}>Ceux qu’il a ajoutés lui-même : ses bons de commande leur sont envoyés directement.</p>
        {propres.length ? (
          <div className="tableau">
            <table className="tableau-super">
              <thead><tr><th>Distributeur</th><th>E-mail</th><th>Téléphone</th><th style={{ textAlign: 'right' }}>Vins sur la carte</th></tr></thead>
              <tbody>{propres.map((f) => (
                <tr key={f.id}><td><b>{f.nom}</b>{f.contact && <div className="petit discret">{f.contact}</div>}</td><td>{f.email ?? '—'}</td><td>{f.telephone ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{f.vins}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="discret" style={{ margin: 0 }}>Aucun distributeur à lui.</p>}
      </section>
    </>
  );
}
