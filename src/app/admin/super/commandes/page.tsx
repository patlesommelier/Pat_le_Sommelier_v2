// Super-admin — Commandes passées par Quid Vinum : restaurant, vins commandés (prix du restaurant et prix QV du tarif),
// et le suivi par Quid Vinum : reçue, acceptée, envoyée au distributeur, livrée, facturée.
import Link from 'next/link';
import { changerStatutQv, decisionCommandeQv, deposerFactureQv, refuserCommandeQv, supprimerFactureQv } from '../commandes-actions';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { VignetteVin } from '@/components/admin/VignetteVin';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Etat } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { euros, referenceCommande } from '@/lib/bon-commande';
import { commandesHorsQv, commandesQv, STATUTS_QV } from '@/lib/super/commandes';

export const dynamic = 'force-dynamic';

const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Brussels' });
// On arrive sur les commandes ouvertes (ni réceptionnées ni annulées) ; « Toutes » les montre sans filtre.
const FILTRES = [['', 'Ouvertes'], ['a_envoyer', 'Pas encore envoyées'], ...STATUTS_QV, ['refusee', 'Refusées'], ['annulee', 'Annulées'], ['toutes', 'Toutes'], ['hors_qv', 'Commandes hors Quid Vinum']] as const;

export default async function CommandesQv({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await exigerAdmin();
  const { statut } = await searchParams;
  // Onglet « Commandes hors Quid Vinum » : les commandes des restaurants à leurs propres distributeurs, en lecture seule.
  if (statut === 'hors_qv') {
    const horsQv = await commandesHorsQv();
    return (
      <>
        <Entete titre="Commandes" texte="Les commandes des restaurants à leurs propres distributeurs : elles ne passent pas par Quid Vinum (pour information, sans suivi)." />
        <nav className="onglets" aria-label="Statut">
          {FILTRES.map(([k, l]) => <Link key={k} href={k ? `/admin/super/commandes?statut=${k}` : '/admin/super/commandes'} aria-current={(statut ?? '') === k ? 'true' : undefined}>{l}</Link>)}
        </nav>
        {!horsQv.length && <p className="discret">Aucune commande hors Quid Vinum.</p>}
        <div className="pile" style={{ gap: 12 }}>
          {horsQv.map((c) => {
            const ref = referenceCommande({ numero: c.numero, date: new Date(c.cree_le) });
            const bouteilles = c.lignes.reduce((n, l) => n + l.quantite, 0);
            const total = c.lignes.reduce((n, l) => n + (l.prix_achat ?? 0) * l.quantite, 0);
            const recues = c.lignes.reduce((n, l) => n + l.recue, 0);
            return (
              <article key={c.id} className="carte-bo pile" style={{ gap: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="pile" style={{ gap: 2 }}>
                    <span className="surtitre">Commande n° {ref}{c.reference_interne ? ` (réf. ${c.reference_interne})` : ''} · {date(c.cree_le)}</span>
                    <b style={{ fontSize: 18 }}><Link href={`/admin/${c.restaurant_id}/commandes?commande=${c.id}`}>{c.restaurant}</Link></b>
                    <span className="petit discret">Chez {c.fournisseur}</span>
                  </span>
                  {c.statut === 'recue' ? <Etat type="ok">Réceptionnée{c.recue_le ? ` le ${date(c.recue_le)}` : ''}</Etat>
                    : c.statut === 'annulee' ? <Etat type="defaut">Annulée</Etat>
                    : recues ? <Etat type="propose">Réception partielle : {recues} / {bouteilles}</Etat>
                    : c.envoyee_le ? <Etat type="propose">Envoyée le {date(c.envoyee_le)}</Etat> : <Etat type="attention">Pas encore envoyée</Etat>}
                </div>
                <div className="tableau"><table style={{ minWidth: 560 }}>
                  <thead><tr><th>Vin</th><th className="droite">Bouteilles</th><th className="droite">Prix HTVA</th><th className="droite">Total HTVA</th></tr></thead>
                  <tbody>{c.lignes.map((l, i) => (
                    <tr key={i}>
                      <td><b>{l.libelle}</b>{l.detail && <div className="petit discret">{l.detail}</div>}</td>
                      <td className="droite"><b>{l.quantite}</b></td>
                      <td className="droite">{l.prix_achat != null ? euros(l.prix_achat) : '—'}</td>
                      <td className="droite"><b>{l.prix_achat != null ? euros(l.prix_achat * l.quantite) : '—'}</b></td>
                    </tr>
                  ))}</tbody>
                </table></div>
                <span className="petit">{bouteilles} bouteille{bouteilles > 1 ? 's' : ''}{c.lignes.some((l) => l.prix_achat != null) && <> · <b>Total {euros(total)} HTVA</b></>}</span>
              </article>
            );
          })}
        </div>
      </>
    );
  }
  const commandes = await commandesQv(statut);
  return (
    <>
      <Entete titre="Commandes" texte="Les commandes des restaurants passées par Quid Vinum : le détail des vins et des prix, et leur suivi. Changez le statut à chaque étape." />
      <nav className="onglets" aria-label="Statut">
        {FILTRES.map(([k, l]) => <Link key={k} href={k ? `/admin/super/commandes?statut=${k}` : '/admin/super/commandes'} aria-current={(statut ?? '') === k ? 'true' : undefined}>{l}</Link>)}
      </nav>
      {!commandes.length && <p className="discret">{statut ? 'Aucune commande.' : 'Aucune commande ouverte.'}</p>}
      <div className="pile" style={{ gap: 12 }}>
        {commandes.map((c) => {
          const ref = referenceCommande({ numero: c.numero, date: new Date(c.cree_le) });
          const bouteilles = c.lignes.reduce((n, l) => n + l.quantite, 0);
          const total = c.lignes.reduce((n, l) => n + (l.prix_achat ?? 0) * l.quantite, 0);
          const totalQv = c.lignes.every((l) => l.prix_qv != null) ? c.lignes.reduce((n, l) => n + l.prix_qv! * l.quantite, 0) : null;
          // Commande livrée (ou réceptionnée par le restaurant) : repliée sous une flèche, avec un ✓ vert ; le détail au clic.
          const livree = c.statut === 'recue' || c.statut_qv === 'livree' || c.statut_qv === 'facturee';
          const Bloc = livree ? 'details' : 'article';
          return (
            <Bloc key={c.id} className={`carte-bo pile${livree ? ' bloc-fiche commande-livree' : ''}`} style={{ gap: 10 }}>
              {livree && (
                <summary>
                  <span className="coche-acceptee" role="img" aria-label="Commande livrée" title="Commande livrée">✓</span>
                  <span className="pile" style={{ gap: 2 }}>
                    <span className="surtitre">Commande n° {ref}{c.reference_interne ? ` (réf. ${c.reference_interne})` : ''} · {date(c.cree_le)}</span>
                    <b>{c.restaurant}</b>
                  </span>
                  <span className="petit discret" style={{ marginLeft: 'auto' }}>{STATUTS_QV.find(([k]) => k === c.statut_qv)?.[1] ?? 'Réceptionnée'} · {euros(total)} HTVA</span>
                </summary>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="pile" style={{ gap: 2 }}>
                  <span className="surtitre">Commande n° {ref}{c.reference_interne ? ` (réf. ${c.reference_interne})` : ''} · {date(c.cree_le)}{c.envoyee_le ? ` · envoyée le ${date(c.envoyee_le)}` : ''}</span>
                  <b style={{ fontSize: 18 }}><Link href={`/admin/${c.restaurant_id}/commandes?commande=${c.id}`}>{c.restaurant}</Link></b>
                  <span className="petit discret">{c.destinataire}</span>
                </span>
                {c.statut_qv === 'refusee' ? <Etat type="attention">Commande refusée</Etat>
                  : c.statut === 'annulee' ? <Etat type="defaut">Annulée par le restaurant</Etat>
                  : !c.envoyee_le ? <Etat type="attention">Pas encore envoyée par le restaurant</Etat>
                  : (
                    <span className="pile" style={{ gap: 8, alignItems: 'flex-end' }}>
                    {/* En attente de validation : accepter, ou refuser avec une explication (le restaurant voit la décision). */}
                    {(c.statut_qv ?? 'recue') === 'recue' ? (
                      <FormulaireAdmin action={decisionCommandeQv.bind(null, c.id)}>
                        <input type="hidden" name="decision" value="accepter" />
                        <button className="btn vert">✓ Valider la commande</button>
                      </FormulaireAdmin>
                    ) : (
                    // Statut : grande liste en couleur, enregistrée à chaque changement (le restaurant le voit aussitôt).
                    <FormulaireAdmin auto action={changerStatutQv.bind(null, c.id)} className="pile" style={{ gap: 4, alignItems: 'flex-end' }}>
                      <select key={c.statut_qv ?? ''} name="statut_qv" defaultValue={c.statut_qv ?? 'acceptee'} aria-label="Statut de la commande" className="select-statut" data-statut={c.statut_qv ?? 'acceptee'}>
                        {STATUTS_QV.filter(([k]) => k !== 'recue').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      {c.statut_qv_le && <span className="petit discret">depuis le {date(c.statut_qv_le)}</span>}
                    </FormulaireAdmin>
                    )}
                    </span>
                  )}
              </div>
              {c.statut_qv === 'refusee' && c.motif_refus && <p className="message" style={{ margin: 0, background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Motif du refus : {c.motif_refus}</p>}
              <div className="tableau tableau-commande"><table>
                <thead><tr><th>Vin</th><th>Distributeur</th><th className="droite">Bouteilles</th><th className="droite">Prix HTVA</th><th className="droite" title="Prix QV du tarif actuel">Prix QV</th><th className="droite">Total HTVA</th></tr></thead>
                <tbody>{c.lignes.map((l, i) => (
                  <tr key={i}>
                    <td style={{ minWidth: 280 }}><div className="vin-cell"><VignetteVin url={l.etiquette} logo={l.logo} taille={44} />
                      <div><b>{l.libelle}</b>{l.detail && <div className="petit discret">{l.detail}</div>}</div></div></td>
                    <td className="petit">{l.distributeur ?? '—'}</td>
                    <td className="droite"><b>{l.quantite}</b>{l.recue > 0 && <div className="petit discret">{l.recue} reçue{l.recue > 1 ? 's' : ''}</div>}</td>
                    <td className="droite">{l.prix_achat != null ? euros(l.prix_achat) : '—'}</td>
                    <td className="droite discret">{l.prix_qv != null ? euros(l.prix_qv) : '—'}</td>
                    <td className="droite"><b>{l.prix_achat != null ? euros(l.prix_achat * l.quantite) : '—'}</b></td>
                  </tr>
                ))}</tbody>
                {/* Le total de la commande, sous les lignes. */}
                <tfoot><tr>
                  <td colSpan={2}><b>Total de la commande</b></td>
                  <td className="droite"><b>{bouteilles}</b></td>
                  <td />
                  <td className="droite discret">{totalQv != null ? euros(totalQv) : '—'}</td>
                  <td className="droite"><b className="total-commande">{euros(total)} HTVA</b></td>
                </tr></tfoot>
              </table></div>
              <div className="ligne-actions" style={{ alignItems: 'center' }}>
                {totalQv != null && <span className="petit discret">Marge Quid Vinum : {euros(total - totalQv)}</span>}
                <a href={`/admin/${c.restaurant_id}/commandes/${c.id}/pdf`} target="_blank" rel="noopener" className="btn sec petit">Bon de commande (PDF)</a>
                {/* Facture : « Envoyer la facture » (le PDF choisi part aussitôt) ; jointe, elle se consulte ou se supprime (pour en joindre une autre). */}
                {c.facture_le ? <>
                  <a href={`/admin/${c.restaurant_id}/commandes/${c.id}/facture`} target="_blank" rel="noopener" className="btn sec petit">Facture (PDF)</a>
                  <span className="petit discret">jointe le {date(c.facture_le)}</span>
                  <BoutonSupprimer action={supprimerFactureQv.bind(null, c.id)} libelle="Supprimer la facture" className="btn fantome petit"
                    question="Supprimer la facture de cette commande ? Le restaurant ne la verra plus ; vous pourrez en joindre une autre." />
                </> : c.statut !== 'annulee' && (
                  <FormulaireAdmin auto action={deposerFactureQv.bind(null, c.id)} style={{ display: 'inline-flex' }}>
                    <label className="btn petit" style={{ cursor: 'pointer' }}>
                      Envoyer la facture
                      <input type="file" name="facture" accept="application/pdf,.pdf" hidden />
                    </label>
                  </FormulaireAdmin>
                )}
              </div>
              {/* Refus : un motif court, montré au restaurant (sa commande est annulée). */}
              {c.statut === 'ouverte' && c.envoyee_le && (c.statut_qv ?? 'recue') === 'recue' && (
                <details className="refus-commande">
                  <summary className="petit" style={{ cursor: 'pointer', color: 'var(--ocre)', fontWeight: 700 }}>Refuser cette commande…</summary>
                  <FormulaireAdmin action={refuserCommandeQv.bind(null, c.id)} className="pile" style={{ gap: 8, marginTop: 8 }}>
                    <div className="champ" style={{ margin: 0 }}><label htmlFor={`motif-${c.id}`}>Pourquoi ? (le restaurant le lira)</label>
                      <textarea id={`motif-${c.id}`} name="motif" rows={2} maxLength={500} required placeholder="Ex. Ce vin n’est plus disponible chez le distributeur ; minimum de 12 bouteilles non atteint." /></div>
                    <span><button className="btn rouge petit">Refuser la commande</button></span>
                  </FormulaireAdmin>
                </details>
              )}
            </Bloc>
          );
        })}
      </div>
    </>
  );
}
