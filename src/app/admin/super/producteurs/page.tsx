import Link from 'next/link';
import { validerDepuisListe } from '../actions';
import { Entete, Message, Vignette } from '@/components/admin/Ui';
import { producteursAValider } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';

/** File d'attente : producteurs repérés sur les cartes et absents de la base de Pat. */
export default async function ProducteursAValider({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const prods = await producteursAValider();
  return (
    <>
      <Entete titre="Producteurs à valider" texte="Producteurs trouvés sur les cartes des restaurants. Tant qu’ils ne sont pas validés, le restaurant voit « Nouveau producteur ». À la validation, fixez leur ranking : leurs vins passent « Déjà référencé » et sont reclassés." />
      <Message ok={sp.ok} erreur={sp.erreur} />
      {!prods.length && <p className="discret">Aucun producteur en attente.</p>}
      <div className="tableau">
        <table style={{ minWidth: 760 }}>
          <thead><tr><th>Producteur</th><th>Région</th><th className="droite">Vins sur les cartes</th><th>Restaurants</th><th className="droite">Ranking</th><th /></tr></thead>
          <tbody>
            {prods.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/super/producteurs/${encodeURIComponent(p.id)}`}><b>{p.nom}</b></Link>
                  {p.photos.length > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{p.photos.map((u) => <Vignette key={u} url={u} taille={36} />)}</div>}</td>
                <td>{[p.region, p.pays].filter(Boolean).join(' · ') || '—'}</td>
                <td className="droite">{p.vins}</td>
                <td>{p.restaurants ?? '—'}</td>
                <td className="droite" colSpan={2}>
                  {/* Validation directe : ranking proposé = suggestion de Pat ; les rankings propres aux cuvées sont gardés. */}
                  <form action={validerDepuisListe.bind(null, p.id)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <input className="rk" name="ranking" type="number" min={0} max={5} step={1} required defaultValue={p.ranking_suggere ?? ''}
                      aria-label={`Ranking de ${p.nom}`} title={p.ranking_suggere !== null ? 'Suggestion de Pat' : 'Pas de suggestion : saisissez un ranking'} />
                    <button className="btn petit">Valider</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
