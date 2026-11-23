// Frigos connectés — Bons de commande : les commandes passées à LVQNEP, le distributeur des frigos.
import Link from 'next/link';
import { exigerCave } from '@/lib/admin/garde-cave';
import { Entete } from '@/components/admin/Ui';
import { commandesFrigo, etatCommandeFrigo } from '@/lib/frigos/documents';
import { euros, referenceCommande } from '@/lib/bon-commande';

const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' });

export default async function BonsFrigo({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerCave(resto);
  const commandes = await commandesFrigo(resto);
  return (
    <>
      <Entete titre="Bons de commande" texte="Les commandes passées à LVQNEP pour vos frigos connectés." />
      {!commandes.length ? <p className="discret">Aucun bon de commande pour l’instant.</p> : (
        <div className="carte-bo" style={{ padding: 0 }}><div className="tableau"><table>
          <thead><tr><th>N°</th><th>Date</th><th>État</th><th className="droite">Bouteilles</th><th className="droite">Montant HTVA</th><th /></tr></thead>
          <tbody>
            {commandes.map((c) => (
              <tr key={c.id} style={c.statut === 'annulee' ? { opacity: 0.55 } : undefined}>
                <td><b>{referenceCommande({ numero: c.numero, date: new Date(c.cree_le) })}</b></td>
                <td>{date(c.cree_le)}</td>
                <td>{etatCommandeFrigo(c)}</td>
                <td className="droite">{c.bouteilles}</td>
                <td className="droite">{c.montant != null ? euros(c.montant) : '—'}</td>
                <td className="droite"><Link href={`/admin/${resto}/commandes/${c.id}`} className="btn sec petit">Bon de commande (PDF)</Link></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
    </>
  );
}
