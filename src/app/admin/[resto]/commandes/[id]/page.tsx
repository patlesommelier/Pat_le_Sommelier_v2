// Bon de commande d'une commande de vin : le PDF, avec « Envoyer la commande » (puis le statut « Commande envoyée »).
// On y arrive après avoir validé une commande ; une fois envoyée, retour à la liste des commandes.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { envoyerCommande, marquerEnvoyee } from '../../../stocks-actions';
import { EnvoiCommande } from '@/components/admin/EnvoiCommande';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getCommandes, getCoordonnees } from '@/lib/admin/stocks';
import { euros, referenceCommande } from '@/lib/bon-commande';
import { envoiEmailConfigure } from '@/lib/email';
import { STATUTS_QV } from '@/lib/super/commandes';

// Commande Quid Vinum envoyée : son statut suit Quid Vinum.
const SUIVI_QV: Record<string, string> = { recue: 'Commande envoyée · en attente de validation', acceptee: 'En cours de traitement', envoyee_distributeur: 'En cours de livraison',
  livree: 'Bouteilles livrées', livree_partielle: 'Livraison partielle', facturee: 'Commande livrée' };
const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' });

export default async function BonDeCommande({ params, searchParams }: { params: Promise<{ resto: string; id: string }>; searchParams: Promise<{ suite?: string; n?: string; total?: string; ok?: string }> }) {
  const { resto, id } = await params;
  const sp = await searchParams;
  // Panier commandé en plusieurs bons : « suite » donne les commandes suivantes, envoyées l'une après l'autre.
  const suite = (sp.suite ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const rang = Number(sp.n) || 1, nombre = Number(sp.total) || suite.length + 1;
  const suivante = suite.length ? `/admin/${resto}/commandes/${suite[0]}?${new URLSearchParams({ suite: suite.slice(1).join(','), n: String(rang + 1), total: String(nombre) })}` : null;
  await exigerAcces(resto);
  const [commandes, coord] = await Promise.all([getCommandes(resto, ['ouverte', 'recue', 'annulee'], 500), getCoordonnees(resto)]);
  const c = commandes.find((x) => x.id === id);
  if (!c) notFound();
  const ref = referenceCommande({ numero: c.numero, date: new Date(c.cree_le) });
  const total = c.lignes.reduce((n, l) => n + l.quantite, 0);
  const nomResto = coord?.commande_societe || coord?.nom || '';
  const sujet = `Bon de commande ${ref} — ${nomResto}${c.via_qv ? ` — ${c.fournisseur_nom}` : ''}`;
  const corps = `Bonjour,\n\nVeuillez trouver ci-joint notre bon de commande n° ${ref} (${total} bouteille${total > 1 ? 's' : ''}) :\n\n${c.lignes.map((l) => `- ${l.quantite} × ${l.libelle}${l.detail ? ` (${l.detail})` : ''}${l.prix_achat != null ? ` à ${euros(l.prix_achat)} HTVA` : ''}`).join('\n')}${c.reference_interne ? `\n\nNotre référence interne : ${c.reference_interne}` : ''}\n\nMerci de nous confirmer la commande et la date de livraison.\n\n${nomResto}`;
  const pdf = `/admin/${resto}/commandes/${c.id}/pdf`;
  const envoyee = Boolean(c.envoyee_le);
  return (
    <>
      <Link href={`/admin/${resto}/commandes`} className="lien-ligne" style={{ minHeight: 0, marginBottom: -8 }}>← Commandes</Link>
      <Entete titre={`Commande n° ${ref}`} texte={`${c.fournisseur_nom}${c.reference_interne ? ` · réf. interne ${c.reference_interne}` : ''} · ${total} bouteille${total > 1 ? 's' : ''}${c.lignes.some((l) => l.prix_achat != null) ? ` · ${euros(c.lignes.reduce((n, l) => n + (l.prix_achat ?? 0) * l.quantite, 0))} HTVA` : ''}`}>
        <span className="statut-commande">{c.statut === 'ouverte'
          ? (envoyee && c.via_qv ? (c.statut_qv && c.statut_qv !== 'recue' ? <span className="statut-qv-resto"><span className="coche-acceptee" role="img" aria-label="Commande acceptée par Quid Vinum" title="Commande acceptée par Quid Vinum">✓</span>
                  <span className="etat statut-qv" data-statut={c.statut_qv}>{STATUTS_QV.find(([k]) => k === c.statut_qv)?.[1] ?? c.statut_qv}</span></span> : <Etat type="propose">{SUIVI_QV.recue}</Etat>)
            : envoyee ? <Etat type="ok">Commande envoyée le {date(c.envoyee_le!)}</Etat> : <Etat type="attention">À envoyer</Etat>)
          : c.statut === 'recue' ? <span className="etat vert">Bouteilles réceptionnées le {date(c.recue_le!)}</span> : c.statut_qv === 'refusee' ? <Etat type="attention">Commande refusée</Etat> : <Etat type="defaut">Annulée</Etat>}</span>
      </Entete>
      {c.statut_qv === 'refusee' && c.motif_refus && <p className="message" style={{ margin: 0, background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Quid Vinum a refusé cette commande : {c.motif_refus}</p>}
      {/* Commande précédente envoyée : son message ; puis où l'on en est parmi les bons du panier. */}
      <Message ok={sp.ok} />
      {nombre > 1 && (sp.suite !== undefined || rang > 1) && (
        <div className="carte-bo ligne-actions" style={{ alignItems: 'center', border: '1.5px solid var(--rouge)' }}>
          <b>Bon de commande {rang} sur {nombre}</b>
          <span className="petit discret">{suivante ? 'Envoyez-le : le bon suivant s’ouvre ensuite.' : 'C’est le dernier bon de votre panier.'}</span>
          {suivante && <Link href={suivante} className="btn fantome petit">Passer au bon suivant →</Link>}
        </div>
      )}
      {c.statut === 'ouverte' && (
        <div className="carte-bo ligne-actions" style={{ alignItems: 'flex-start' }}>
          {c.fournisseur_email
            ? <EnvoiCommande pdf={pdf} fichier={`bon-de-commande-${ref}.pdf`} email={c.fournisseur_email} sujet={sujet} corps={corps}
                serveur={envoiEmailConfigure()} envoyer={envoyerCommande.bind(null, resto, c.id)} marquer={marquerEnvoyee.bind(null, resto, c.id)} deja={envoyee}
                apres={envoyee ? undefined : suivante ?? `/admin/${resto}/commandes?commande=${c.id}`} />
            : <span className="petit" style={{ color: 'var(--ocre)' }}>{c.via_qv ? 'L’adresse des commandes de Quid Vinum n’est pas encore renseignée : contactez Quid Vinum.'
                : <>Pour envoyer la commande, ajoutez l’adresse e-mail du distributeur dans <Link href={`/admin/${resto}/fournisseurs`}>Distributeurs</Link>.</>}</span>}
          <a href={pdf} target="_blank" rel="noopener" className="btn sec">Ouvrir le PDF</a>
          {c.facture_le && <a href={`/admin/${resto}/commandes/${c.id}/facture`} target="_blank" rel="noopener" className="btn sec">Facture (PDF)</a>}
          <span className="petit discret" style={{ alignSelf: 'center' }}>{c.via_qv ? 'La commande part chez Quid Vinum' : 'La commande part chez le distributeur'}{c.fournisseur_email ? ` (${c.fournisseur_email})` : ''}, votre restaurant en copie.</span>
        </div>
      )}
      {/* Aperçu du bon de commande (toujours : on peut le relire avant de le renvoyer). */}
      <iframe src={pdf} title={`Bon de commande ${ref}`} style={{ width: '100%', height: 'min(1100px, 85vh)', border: '1px solid var(--ligne)', borderRadius: 14, background: '#fff' }} />
    </>
  );
}
