// Frigos connectés — Factures : les factures de LVQNEP jointes aux commandes des frigos.
import { exigerCave } from '@/lib/admin/garde-cave';
import { Entete } from '@/components/admin/Ui';
import { commandesFrigo } from '@/lib/frigos/documents';
import { euros, referenceCommande } from '@/lib/bon-commande';

const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' });

export default async function FacturesFrigo({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerCave(resto);
  const factures = (await commandesFrigo(resto)).filter((c) => c.facture_le);
  return (
    <>
      <Entete titre="Factures" texte="Les factures de LVQNEP pour vos frigos connectés." />
      {!factures.length ? <p className="discret">Aucune facture pour l’instant.</p> : (
        <div className="carte-bo" style={{ padding: 0 }}><div className="tableau"><table>
          <thead><tr><th>Date</th><th>Commande</th><th className="droite">Montant HTVA</th><th /></tr></thead>
          <tbody>
            {factures.map((c) => (
              <tr key={c.id}>
                <td>{date(c.facture_le!)}</td>
                <td>{referenceCommande({ numero: c.numero, date: new Date(c.cree_le) })}</td>
                <td className="droite">{c.montant != null ? euros(c.montant) : '—'}</td>
                <td className="droite"><a href={`/admin/${resto}/commandes/${c.id}/facture`} target="_blank" rel="noopener" className="btn sec petit">Facture (PDF)</a></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
    </>
  );
}
