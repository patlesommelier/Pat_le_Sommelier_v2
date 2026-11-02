// Bon de commande d'une commande de vin : le PDF, avec « Envoyer la commande » (puis le statut « Commande envoyée »).
// On y arrive après avoir validé une commande ; une fois envoyée, retour à la liste des commandes.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { envoyerCommande, marquerEnvoyee } from '../../../stocks-actions';
import { EnvoiCommande } from '@/components/admin/EnvoiCommande';
import { Entete, Etat } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getCommandes, getCoordonnees } from '@/lib/admin/stocks';
import { euros, referenceCommande } from '@/lib/bon-commande';
import { envoiEmailConfigure } from '@/lib/email';

const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' });

export default async function BonDeCommande({ params }: { params: Promise<{ resto: string; id: string }> }) {
  const { resto, id } = await params;
  await exigerAcces(resto);
  const [commandes, coord] = await Promise.all([getCommandes(resto, ['ouverte', 'recue', 'annulee'], 500), getCoordonnees(resto)]);
  const c = commandes.find((x) => x.id === id);
  if (!c) notFound();
  const ref = referenceCommande({ numero: c.numero, date: new Date(c.cree_le) });
  const total = c.lignes.reduce((n, l) => n + l.quantite, 0);
  const nomResto = coord?.commande_societe || coord?.nom || '';
  const sujet = `Bon de commande ${ref} — ${nomResto}${c.via_qv ? ` — ${c.fournisseur_nom}` : ''}`;
  const corps = `Bonjour,\n\nVeuillez trouver ci-joint notre bon de commande n° ${ref} (${total} bouteille${total > 1 ? 's' : ''}) :\n\n${c.lignes.map((l) => `- ${l.quantite} × ${l.libelle}${l.detail ? ` (${l.detail})` : ''}${l.prix_achat != null ? ` à ${euros(l.prix_achat)} HTVA` : ''}`).join('\n')}\n\nMerci de nous confirmer la commande et la date de livraison.\n\n${nomResto}`;
  const pdf = `/admin/${resto}/commandes/${c.id}/pdf`;
  const envoyee = Boolean(c.envoyee_le);
  return (
    <>
      <Link href={`/admin/${resto}/commandes`} className="lien-ligne" style={{ minHeight: 0, marginBottom: -8 }}>← Commandes</Link>
      <Entete titre={`Commande n° ${ref}`} texte={`${c.fournisseur_nom} · ${total} bouteille${total > 1 ? 's' : ''}${c.lignes.some((l) => l.prix_achat != null) ? ` · ${euros(c.lignes.reduce((n, l) => n + (l.prix_achat ?? 0) * l.quantite, 0))} HTVA` : ''}`}>
        {c.statut === 'ouverte'
          ? (envoyee ? <Etat type="ok">Commande envoyée le {date(c.envoyee_le!)}</Etat> : <Etat type="attention">À envoyer</Etat>)
          : c.statut === 'recue' ? <Etat type="ok">Bouteilles réceptionnées le {date(c.recue_le!)}</Etat> : <Etat type="defaut">Annulée</Etat>}
      </Entete>
      {c.statut === 'ouverte' && (
        <div className="carte-bo ligne-actions" style={{ alignItems: 'flex-start' }}>
          {c.fournisseur_email
            ? <EnvoiCommande pdf={pdf} fichier={`bon-de-commande-${ref}.pdf`} email={c.fournisseur_email} sujet={sujet} corps={corps}
                serveur={envoiEmailConfigure()} envoyer={envoyerCommande.bind(null, resto, c.id)} marquer={marquerEnvoyee.bind(null, resto, c.id)} deja={envoyee}
                apres={`/admin/${resto}/commandes?commande=${c.id}`} />
            : <span className="petit" style={{ color: 'var(--ocre)' }}>{c.via_qv ? 'L’adresse des commandes de Quid Vinum n’est pas encore renseignée : contactez Quid Vinum.'
                : <>Pour envoyer la commande, ajoutez l’adresse e-mail du distributeur dans <Link href={`/admin/${resto}/fournisseurs`}>Distributeurs</Link>.</>}</span>}
          <a href={pdf} target="_blank" rel="noopener" className="btn sec">Ouvrir le PDF</a>
          <span className="petit discret" style={{ alignSelf: 'center' }}>{c.via_qv ? 'La commande part chez Quid Vinum' : 'La commande part chez le distributeur'}{c.fournisseur_email ? ` (${c.fournisseur_email})` : ''}, votre restaurant en copie.</span>
        </div>
      )}
      {/* Une fois la commande envoyée, plus d'aperçu : « Ouvrir le PDF » suffit. */}
      {!envoyee && <iframe src={pdf} title={`Bon de commande ${ref}`} style={{ width: '100%', height: 'min(1100px, 85vh)', border: '1px solid var(--ligne)', borderRadius: 14, background: '#fff' }} />}
    </>
  );
}
