import Link from 'next/link';
import { ajouterCuvee, changerRanking } from '../actions';
import { Entete, Etat, euros } from '@/components/admin/Ui';
import { detailsProducteurs, paysProducteurs, rechercherProducteurs, rechercherTerroirs, restaurantsListe } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blanc', rose: 'Rosé', rouge: 'Rouge', orange: 'Orange', doux: 'Doux' };
type Sp = { onglet?: string; q?: string; pays?: string; resto?: string; page?: string };

/** Base de Pat : producteurs et leurs vins, terroirs ; rankings modifiables (cuisine interne). */
export default async function Base({ searchParams }: { searchParams: Promise<Sp> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const onglet = sp.onglet === 'terroirs' ? 'terroirs' : 'producteurs';
  const page = Math.max(0, Number(sp.page) || 0);
  const filtres = { texte: sp.q ?? '', pays: sp.pays ?? '', restaurant: sp.resto ?? '', page };
  const [pays, restos] = await Promise.all([paysProducteurs(), restaurantsListe()]);
  const lien = (extra: Partial<Sp>) => `/admin/super/base?${new URLSearchParams(Object.entries({ onglet, q: sp.q, pays: sp.pays, resto: sp.resto, ...extra }).filter(([, v]) => v) as [string, string][])}`;
  const retour = lien({ page: page ? String(page) : undefined });

  const recherche = (
    <form method="get" className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', padding: '14px 18px' }}>
      <input type="hidden" name="onglet" value={onglet} />
      <div className="champ" style={{ flex: '1 1 220px' }}><label htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={sp.q ?? ''} placeholder={onglet === 'terroirs' ? 'Appellation, climat, région…' : 'Producteur ou région…'} /></div>
      <div className="champ"><label htmlFor="pays">Pays</label>
        <select id="pays" name="pays" defaultValue={sp.pays ?? ''}><option value="">Tous</option>{pays.map((p) => <option key={p}>{p}</option>)}</select></div>
      {onglet === 'producteurs' && <div className="champ"><label htmlFor="resto">Restaurant</label>
        <select id="resto" name="resto" defaultValue={sp.resto ?? ''}><option value="">Tous</option>{restos.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</select></div>}
      <button className="btn petit">Filtrer</button>
    </form>
  );

  const pagination = (total: number) => total > 50 && (
    <div className="ligne-actions">
      {page > 0 && <Link href={lien({ page: String(page - 1) })} className="btn fantome petit">← Précédents</Link>}
      <span className="discret">{page * 50 + 1}–{Math.min(total, (page + 1) * 50)} sur {total.toLocaleString('fr-BE')}</span>
      {(page + 1) * 50 < total && <Link href={lien({ page: String(page + 1) })} className="btn fantome petit">Suivants →</Link>}
    </div>
  );

  const ranking = (type: 'producteur' | 'terroir', id: string, valeur: number | null, libelle: string) => (
    <form action={changerRanking.bind(null, type, id)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="retour" value={retour} />
      <input className="rk" name="ranking" type="number" min={0} max={5} step={1} defaultValue={valeur ?? ''} aria-label={`Ranking de ${libelle}`} />
      <button className="btn fantome petit">OK</button>
    </form>
  );

  return (
    <>
      <Entete titre="Base et rankings" texte="La base de Pat : producteurs, leurs vins et les terroirs. Les rankings sont la cuisine interne de Pat : ils ne sont jamais montrés aux restaurants." />
      <nav className="ligne-actions" aria-label="Onglets">
        <Link href="/admin/super/base" className={`btn ${onglet === 'producteurs' ? '' : 'sec'} petit`}>Producteurs et vins</Link>
        <Link href="/admin/super/base?onglet=terroirs" className={`btn ${onglet === 'terroirs' ? '' : 'sec'} petit`}>Terroirs</Link>
      </nav>
      {recherche}
      {onglet === 'producteurs' ? await (async () => {
        const { lignes, total } = await rechercherProducteurs(filtres);
        const details = await detailsProducteurs(lignes.map((l) => l.id));
        return (
          <section className="pile" style={{ gap: 8 }}>
            {pagination(total)}
            {!lignes.length && <p className="discret">Aucun producteur.</p>}
            {lignes.map((p) => (
              <details key={p.id} className="carte-bo" style={{ padding: '10px 16px' }}>
                <summary style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
                  <b style={{ flex: '1 1 220px' }}>{p.nom}</b>
                  <span className="discret">{[p.region, p.pays].filter(Boolean).join(' · ')}</span>
                  {p.statut !== 'valide' && <Etat type="propose">{p.statut === 'propose' ? 'À valider' : 'Rejeté'}</Etat>}
                  <span className="petit">ranking <b>{p.ranking_pat ?? '—'}</b> · {p.vins_carte} sur les cartes · {p.cuvees} cuvée(s)</span>
                </summary>
                <div className="pile" style={{ gap: 10, marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>Ranking du producteur</span>{ranking('producteur', p.id, p.ranking_pat, p.nom)}
                    {p.statut === 'propose' && <Link href={`/admin/super/producteurs/${encodeURIComponent(p.id)}`}>Ouvrir la fiche à valider</Link>}
                  </div>
                  {(details.vins.get(p.id) ?? []).length > 0 && (
                    <div className="tableau"><table style={{ minWidth: 640 }}>
                      <thead><tr><th>Vin de carte</th><th>Couleur</th><th>Terroir</th><th className="droite">Rk terroir</th><th className="droite">Rk cuvée</th><th>Carte</th><th className="droite">Prix</th></tr></thead>
                      <tbody>{(details.vins.get(p.id) ?? []).map((v: { id: string; libelle: string; millesime: string | null; couleur: string; terroir: string | null; ranking_terroir: number | null; ranking_producteur: number | null; restaurant: string; prix: number | null }) => (
                        <tr key={v.id}><td>{v.libelle}{v.millesime ? ` ${v.millesime}` : ''}</td><td>{COULEURS[v.couleur] ?? v.couleur}</td><td>{v.terroir ?? '—'}</td>
                          <td className="droite">{v.ranking_terroir ?? '—'}</td><td className="droite">{v.ranking_producteur ?? '—'}</td><td>{v.restaurant}</td><td className="droite">{euros(v.prix)}</td></tr>))}
                      </tbody></table></div>
                  )}
                  {(details.cuvees.get(p.id) ?? []).length > 0 && (
                    <span className="petit">Cuvées de la base : {(details.cuvees.get(p.id) ?? []).map((c: { nom: string; appellation: string | null }) => `${c.nom}${c.appellation ? ` (${c.appellation})` : ''}`).join(' · ')}</span>
                  )}
                  <form action={ajouterCuvee.bind(null, p.id)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                    <input type="hidden" name="retour" value={retour} />
                    <div className="champ"><label htmlFor={`cuv-${p.id}`}>Ajouter un vin</label><input id={`cuv-${p.id}`} name="nom" placeholder="Cuvée, sans millésime" required /></div>
                    <div className="champ"><label htmlFor={`coul-${p.id}`}>Couleur</label><select id={`coul-${p.id}`} name="couleur">{Object.entries(COULEURS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                    <div className="champ"><label htmlFor={`cep-${p.id}`}>Cépages</label><input id={`cep-${p.id}`} name="cepages" /></div>
                    <button className="btn sec petit">Ajouter</button>
                  </form>
                </div>
              </details>
            ))}
            {pagination(total)}
          </section>
        );
      })() : await (async () => {
        const { lignes, total } = await rechercherTerroirs(filtres);
        return (
          <section className="pile" style={{ gap: 8 }}>
            <p className="discret" style={{ margin: 0 }}>Le ranking d’un terroir vaut pour tous les vins de ce terroir, dans tous les restaurants : le changer les reclasse.</p>
            {pagination(total)}
            <div className="tableau"><table style={{ minWidth: 620 }}>
              <thead><tr><th>Terroir</th><th>Niveau</th><th>Région</th><th className="droite">Vins sur les cartes</th><th className="droite">Ranking</th></tr></thead>
              <tbody>{lignes.map((t) => (
                <tr key={t.id}><td><b>{t.nom}</b></td><td>{t.niveau}</td><td>{[t.region, t.pays].filter(Boolean).join(' · ')}</td>
                  <td className="droite">{t.vins_carte}</td><td className="droite">{ranking('terroir', t.id, t.ranking_pat, t.nom)}</td></tr>))}
              </tbody></table></div>
            {pagination(total)}
          </section>
        );
      })()}
    </>
  );
}
