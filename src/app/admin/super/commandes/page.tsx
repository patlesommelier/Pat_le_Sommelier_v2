// Super-admin — Commandes passées par Quid Vinum : restaurant, vins commandés (prix du restaurant et prix QV du tarif),
// et le suivi par Quid Vinum : reçue, acceptée, envoyée au distributeur, livrée, facturée.
import Link from 'next/link';
import { changerStatutQv, refuserCommandeQv } from '../commandes-actions';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Etat } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { euros, referenceCommande } from '@/lib/bon-commande';
import { commandesQv, STATUTS_QV } from '@/lib/super/commandes';

export const dynamic = 'force-dynamic';

const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Brussels' });
const FILTRES = [['', 'Toutes'], ['a_envoyer', 'Pas encore envoyées'], ...STATUTS_QV, ['refusee', 'Refusées'], ['annulee', 'Annulées']] as const;

export default async function CommandesQv({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await exigerAdmin();
  const { statut } = await searchParams;
  const commandes = await commandesQv(statut);
  return (
    <>
      <Entete titre="Commandes" texte="Les commandes des restaurants passées par Quid Vinum : le détail des vins et des prix, et leur suivi. Changez le statut à chaque étape." />
      <nav className="onglets" aria-label="Statut">
        {FILTRES.map(([k, l]) => <Link key={k} href={k ? `/admin/super/commandes?statut=${k}` : '/admin/super/commandes'} aria-current={(statut ?? '') === k ? 'true' : undefined}>{l}</Link>)}
      </nav>
      {!commandes.length && <p className="discret">Aucune commande.</p>}
      <div className="pile" style={{ gap: 12 }}>
        {commandes.map((c) => {
          const ref = referenceCommande({ numero: c.numero, date: new Date(c.cree_le) });
          const bouteilles = c.lignes.reduce((n, l) => n + l.quantite, 0);
          const total = c.lignes.reduce((n, l) => n + (l.prix_achat ?? 0) * l.quantite, 0);
          const totalQv = c.lignes.every((l) => l.prix_qv != null) ? c.lignes.reduce((n, l) => n + l.prix_qv! * l.quantite, 0) : null;
          return (
            <article key={c.id} className="carte-bo pile" style={{ gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="pile" style={{ gap: 2 }}>
                  <span className="surtitre">Commande n° {ref}{c.reference_interne ? ` (réf. ${c.reference_interne})` : ''} · {date(c.cree_le)}{c.envoyee_le ? ` · envoyée le ${date(c.envoyee_le)}` : ''}</span>
                  <b style={{ fontSize: 18 }}><Link href={`/admin/${c.restaurant_id}/commandes?commande=${c.id}`}>{c.restaurant}</Link></b>
                  <span className="petit discret">{c.destinataire}</span>
                </span>
                {c.statut_qv === 'refusee' ? <Etat type="attention">Refusée par QV</Etat>
                  : c.statut === 'annulee' ? <Etat type="defaut">Annulée par le restaurant</Etat>
                  : !c.envoyee_le ? <Etat type="attention">Pas encore envoyée par le restaurant</Etat>
                  : (
                    <span className="pile" style={{ gap: 8, alignItems: 'flex-end' }}>
                    {/* En attente de validation : l'acceptation en un clic (le restaurant voit « Commande acceptée » et ne peut plus annuler). */}
                    {(c.statut_qv ?? 'recue') === 'recue' && (
                      <FormulaireAdmin action={changerStatutQv.bind(null, c.id)} className="ligne-actions" style={{ alignItems: 'center' }}>
                        <Etat type="attention">En attente de validation</Etat>
                        <input type="hidden" name="statut_qv" value="acceptee" />
                        <button className="btn rouge petit">Accepter la commande</button>
                      </FormulaireAdmin>
                    )}
                    <FormulaireAdmin action={changerStatutQv.bind(null, c.id)} className="ligne-actions" style={{ alignItems: 'center' }}>
                      <select name="statut_qv" defaultValue={c.statut_qv ?? 'recue'} aria-label="Statut de la commande" className="champ-liste" style={{ width: 'auto' }}>
                        {STATUTS_QV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      <button className="btn sec petit">Enregistrer</button>
                      {c.statut_qv_le && <span className="petit discret">depuis le {date(c.statut_qv_le)}</span>}
                    </FormulaireAdmin>
                    </span>
                  )}
              </div>
              {c.statut_qv === 'refusee' && c.motif_refus && <p className="message" style={{ margin: 0, background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Motif du refus : {c.motif_refus}</p>}
              <div className="tableau"><table style={{ minWidth: 720 }}>
                <thead><tr><th>Vin</th><th>Distributeur</th><th className="droite">Bouteilles</th><th className="droite">Prix restaurant HTVA</th><th className="droite">Prix QV (tarif actuel)</th><th className="droite">Total HTVA</th></tr></thead>
                <tbody>{c.lignes.map((l, i) => (
                  <tr key={i}>
                    <td><b>{l.libelle}</b>{l.detail && <div className="petit discret">{l.detail}</div>}</td>
                    <td className="petit">{l.distributeur ?? '—'}</td>
                    <td className="droite"><b>{l.quantite}</b>{l.recue > 0 && <div className="petit discret">{l.recue} reçue{l.recue > 1 ? 's' : ''}</div>}</td>
                    <td className="droite">{l.prix_achat != null ? euros(l.prix_achat) : '—'}</td>
                    <td className="droite discret">{l.prix_qv != null ? euros(l.prix_qv) : '—'}</td>
                    <td className="droite"><b>{l.prix_achat != null ? euros(l.prix_achat * l.quantite) : '—'}</b></td>
                  </tr>
                ))}</tbody>
              </table></div>
              <span className="petit">{bouteilles} bouteille{bouteilles > 1 ? 's' : ''} · <b>Total {euros(total)} HTVA</b>{totalQv != null && <span className="discret"> · prix QV {euros(totalQv)} · marge {euros(total - totalQv)}</span>}
                {' · '}<a href={`/admin/${c.restaurant_id}/commandes/${c.id}/pdf`} target="_blank" rel="noopener">Bon de commande (PDF)</a></span>
              {/* Refus : un motif court, montré au restaurant (sa commande est annulée). */}
              {c.statut === 'ouverte' && c.envoyee_le && (
                <details className="refus-commande">
                  <summary className="petit" style={{ cursor: 'pointer', color: 'var(--ocre)', fontWeight: 700 }}>Refuser cette commande…</summary>
                  <FormulaireAdmin action={refuserCommandeQv.bind(null, c.id)} className="pile" style={{ gap: 8, marginTop: 8 }}>
                    <div className="champ" style={{ margin: 0 }}><label htmlFor={`motif-${c.id}`}>Pourquoi ? (le restaurant le lira)</label>
                      <textarea id={`motif-${c.id}`} name="motif" rows={2} maxLength={500} required placeholder="Ex. Ce vin n’est plus disponible chez le distributeur ; minimum de 12 bouteilles non atteint." /></div>
                    <span><button className="btn rouge petit">Refuser la commande</button></span>
                  </FormulaireAdmin>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
