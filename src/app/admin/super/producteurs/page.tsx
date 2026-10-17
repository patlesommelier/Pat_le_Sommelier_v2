import Link from 'next/link';
import { ajouterProducteur, changerRanking, validerDepuisListe } from '../actions';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { listerProducteurs, paysProducteurs, regionsProducteurs } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';

type Sp = { q?: string; pays?: string; region?: string; statut?: string; page?: string; ok?: string; erreur?: string };
const STATUTS: Record<string, [string, 'ok' | 'propose' | 'defaut']> = { propose: ['À valider', 'propose'], valide: ['Validé', 'ok'], retire: ['Rejeté', 'defaut'] };

/**
 * Tous les producteurs de la base de Pat (les « à valider » d'abord) : filtres pays, région, statut ;
 * ranking modifiable dans la liste (validation directe pour un producteur à valider) ou dans sa fiche.
 */
export default async function Producteurs({ searchParams }: { searchParams: Promise<Sp> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page) || 0);
  const statut = sp.statut && STATUTS[sp.statut] ? sp.statut : '';
  const [pays, regions, toutesRegions, { lignes, total }] = await Promise.all([
    paysProducteurs(), regionsProducteurs(sp.pays ?? ''), regionsProducteurs(),
    listerProducteurs({ texte: sp.q ?? '', pays: sp.pays ?? '', region: sp.region ?? '', statut, page }),
  ]);
  const lien = (extra: Partial<Sp>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, pays: sp.pays, region: sp.region, statut, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/admin/super/producteurs${p.size ? `?${p}` : ''}`;
  };
  // Après un changement de ranking, on revient sur la même liste (mêmes filtres, même page).
  const retour = lien({ page: page ? String(page) : undefined });

  return (
    <>
      <Entete titre="Producteurs" texte="Tous les producteurs de la base de Pat. Ceux trouvés sur les cartes et pas encore validés sont en tête : tant qu’ils ne le sont pas, le restaurant voit « Nouveau producteur ». Le ranking se change ici ou dans la fiche ; il n’est jamais montré aux restaurants. Un producteur absent de la base s’ajoute ci-dessous." />
      <Message ok={sp.ok} erreur={sp.erreur} />

      {/* Nouveau producteur : il entre dans la base validé, avec son ranking ; sa fiche s'ouvre ensuite pour la compléter. */}
      <details className="carte-bo" style={{ padding: '14px 18px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>+ Ajouter un producteur</summary>
        <form action={ajouterProducteur} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
          <div className="champ" style={{ flex: '2 1 220px' }}><label htmlFor="n-nom">Nom</label><input id="n-nom" name="nom" required placeholder="Ex. Domaine Jules Desjourneys" /></div>
          <div className="champ" style={{ flex: '1 1 140px' }}><label htmlFor="n-pays">Pays</label><input id="n-pays" name="pays" list="liste-pays" placeholder="France" /></div>
          <div className="champ" style={{ flex: '1 1 160px' }}><label htmlFor="n-region">Région</label><input id="n-region" name="region" list="liste-regions" placeholder="Bourgogne" /></div>
          <div className="champ"><label htmlFor="n-rk">Ranking (0 à 5)</label><input id="n-rk" className="rk" name="ranking" type="number" min={0} max={5} step={1} required /></div>
          <button className="btn petit">Ajouter</button>
          <datalist id="liste-pays">{pays.map((p) => <option key={p} value={p} />)}</datalist>
          <datalist id="liste-regions">{toutesRegions.map((r) => <option key={r} value={r} />)}</datalist>
        </form>
      </details>

      <form method="get" className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', padding: '14px 18px' }}>
        <div className="champ" style={{ flex: '1 1 220px' }}><label htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={sp.q ?? ''} placeholder="Nom du producteur…" /></div>
        <div className="champ"><label htmlFor="pays">Pays</label>
          <select id="pays" name="pays" defaultValue={sp.pays ?? ''}><option value="">Tous</option>{pays.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div className="champ"><label htmlFor="region">Région</label>
          <select id="region" name="region" defaultValue={sp.region ?? ''}><option value="">Toutes</option>{regions.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="champ"><label htmlFor="statut">Statut</label>
          <select id="statut" name="statut" defaultValue={statut}><option value="">Tous</option>{Object.entries(STATUTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <button className="btn petit">Filtrer</button>
        {(sp.q || sp.pays || sp.region || statut) && <Link href="/admin/super/producteurs" className="btn fantome petit">Tout afficher</Link>}
      </form>

      <p className="discret" style={{ margin: 0 }}>{total.toLocaleString('fr-BE')} producteur{total > 1 ? 's' : ''}</p>
      {!lignes.length && <p className="discret">Aucun producteur ne correspond à ces filtres.</p>}
      {lignes.length > 0 && (
        <div className="tableau">
          <table style={{ minWidth: 820 }}>
            <thead><tr><th>Producteur</th><th>Région</th><th>Statut</th><th className="droite">Vins sur les cartes</th><th>Restaurants</th><th className="droite">Ranking</th></tr></thead>
            <tbody>
              {lignes.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/admin/super/producteurs/${encodeURIComponent(p.id)}`}><b>{p.nom}</b></Link></td>
                  <td>{[p.region, p.pays].filter(Boolean).join(' · ') || '—'}</td>
                  <td><Etat type={STATUTS[p.statut]?.[1] ?? ''}>{STATUTS[p.statut]?.[0] ?? p.statut}</Etat></td>
                  <td className="droite">{p.vins}</td>
                  <td>{p.restaurants ?? '—'}</td>
                  <td className="droite">
                    {p.statut === 'propose' ? (
                      // Validation directe : ranking proposé = suggestion de Pat ; les rankings propres aux cuvées sont gardés.
                      <form action={validerDepuisListe.bind(null, p.id)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <input type="hidden" name="retour" value={retour} />
                        <input className="rk" name="ranking" type="number" min={0} max={5} step={1} required defaultValue={p.ranking_suggere ?? ''}
                          aria-label={`Ranking de ${p.nom}`} title={p.ranking_suggere !== null ? 'Suggestion de Pat' : 'Pas de suggestion : saisissez un ranking'} />
                        <button className="btn petit">Valider</button>
                      </form>
                    ) : (
                      <form action={changerRanking.bind(null, 'producteur', p.id)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <input type="hidden" name="retour" value={retour} />
                        <input className="rk" name="ranking" type="number" min={0} max={5} step={1} required defaultValue={p.ranking_pat ?? ''} aria-label={`Ranking de ${p.nom}`} />
                        <button className="btn fantome petit">OK</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="ligne-actions">
          {page > 0 && <Link href={lien({ page: String(page - 1) })} className="btn fantome petit">← Précédents</Link>}
          <span className="discret">{page * 50 + 1}–{Math.min(total, (page + 1) * 50)} sur {total.toLocaleString('fr-BE')}</span>
          {(page + 1) * 50 < total && <Link href={lien({ page: String(page + 1) })} className="btn fantome petit">Suivants →</Link>}
        </div>
      )}
    </>
  );
}
