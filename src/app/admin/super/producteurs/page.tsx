import Link from 'next/link';
import { Entete, Message } from '@/components/admin/Ui';
import { producteursAValider } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';

/** File d'attente : producteurs repérés sur les cartes et absents de la base de Pat. */
export default async function ProducteursAValider({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const prods = await producteursAValider();
  return (
    <>
      <Entete titre="Producteurs à valider" texte="Producteurs trouvés sur les cartes des restaurants. Tant qu’ils ne sont pas validés, le restaurant voit « Nouveau producteur ». À la validation, fixez leur ranking : leurs vins passent « Déjà référencé » et sont reclassés." />
      <Message ok={sp.ok} />
      {!prods.length && <p className="discret">Aucun producteur en attente.</p>}
      <div className="tableau">
        <table style={{ minWidth: 640 }}>
          <thead><tr><th>Producteur</th><th>Région</th><th className="droite">Vins sur les cartes</th><th>Restaurants</th><th className="droite">Suggestion de Pat</th></tr></thead>
          <tbody>
            {prods.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/super/producteurs/${encodeURIComponent(p.id)}`}><b>{p.nom}</b></Link></td>
                <td>{[p.region, p.pays].filter(Boolean).join(' · ') || '—'}</td>
                <td className="droite">{p.vins}</td>
                <td>{p.restaurants ?? '—'}</td>
                <td className="droite">{p.ranking_suggere ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
