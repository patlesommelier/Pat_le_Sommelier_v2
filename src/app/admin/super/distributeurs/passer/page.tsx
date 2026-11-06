// Super-admin — passage d'un distributeur des restaurants en distributeur Quid Vinum : ce qui va changer, puis confirmation.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { passerEnQv } from '../../distributeurs-actions';
import { Entete } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { getDistributeurs } from '@/lib/distributeurs/donnees';
import { distributeursNonSignes } from '@/lib/distributeurs/non-signes';

export default async function PasserEnQv({ searchParams }: { searchParams: Promise<{ cle?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { cle } = await searchParams;
  const [groupes, liste] = await Promise.all([distributeursNonSignes(), getDistributeurs()]);
  const g = groupes.find((x) => x.cle === cle);
  if (!g) notFound();
  const n = g.restaurants.length;
  return (
    <>
      <Entete titre={`Passer « ${g.nom} » en distributeur Quid Vinum`} texte={`Chez ${n > 1 ? `ses ${n} restaurants` : 'son restaurant'} d’un coup : ${g.restaurants.map((r) => r.nom).join(', ')}.`}>
        <Link href="/admin/super/distributeurs#non-signes" className="btn sec">← Distributeurs</Link>
      </Entete>
      <form action={passerEnQv} className="carte-bo pile" style={{ gap: 14, maxWidth: 720 }}>
        <input type="hidden" name="cle" value={g.cle} />
        <ul style={{ margin: 0, paddingLeft: 20 }} className="pile">
          <li>Leurs <b>prochaines commandes</b> chez {g.nom} passent par Quid Vinum, au prix public moins leur remise (à régler sur la fiche du distributeur).</li>
          <li>Leurs vins restent chez lui ; ils sont reliés à son catalogue dès qu’un tarif est chargé.</li>
          {g.commandes > 0 && <li>{g.commandes > 1 ? `Les ${g.commandes} commandes déjà envoyées ne changent pas.` : 'La commande déjà envoyée ne change pas.'}</li>}
          <li>Un <b>avis</b> s’affiche en haut de leur espace : « {g.nom} est désormais distributeur Quid Vinum ».</li>
        </ul>
        <div className="champ" style={{ maxWidth: 420 }}><label htmlFor="cible">Distributeur Quid Vinum</label>
          <select id="cible" name="cible" defaultValue={liste.find((d) => d.nom.toLowerCase() === g.nom.toLowerCase())?.id ?? 'nouveau'}>
            <option value="nouveau">Nouveau : « {g.nom} » (coordonnées reprises des restaurants)</option>
            {liste.map((d) => <option key={d.id} value={d.id}>{d.nom} (déjà chez Quid Vinum)</option>)}
          </select></div>
        <span><button className="btn">Confirmer le passage</button></span>
      </form>
    </>
  );
}
