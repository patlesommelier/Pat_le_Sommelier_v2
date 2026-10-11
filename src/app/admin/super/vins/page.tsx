import Link from 'next/link';
import { Entete, Etat, Vignette } from '@/components/admin/Ui';
import { rechercherCuvees, restaurantsListe } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';
import { RetourVin } from '@/components/admin/RetourVin';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blanc', rose: 'Rosé', rouge: 'Rouge', orange: 'Orange', doux: 'Doux' };
const STATUT: Record<string, [string, 'ok' | 'propose' | 'defaut']> = { valide: ['Validé', 'ok'], propose: ['À valider', 'propose'], retire: ['Retiré', 'defaut'] };
type Sp = { q?: string; couleur?: string; statut?: string; resto?: string; cartes?: string; page?: string; vin?: string; ok?: string };

/** Vins de la base de Pat (cuvées) : recherche, filtres, et accès à la fiche de chaque vin. */
export default async function VinsBase({ searchParams }: { searchParams: Promise<Sp> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page) || 0);
  const surCartes = sp.cartes !== '0';
  const [{ lignes, total }, restos] = await Promise.all([
    rechercherCuvees({ texte: sp.q ?? '', couleur: sp.couleur ?? '', statut: sp.statut ?? '', restaurant: sp.resto ?? '', surCartes, page }),
    restaurantsListe(),
  ]);
  // Adresse de la liste telle qu'affichée (filtres et page) : la fiche y ramène après une validation.
  const ici = `/admin/super/vins?${new URLSearchParams(Object.entries({ q: sp.q, couleur: sp.couleur, statut: sp.statut, resto: sp.resto, cartes: sp.cartes, page: sp.page }).filter(([, v]) => v) as [string, string][])}`;
  const lien = (extra: Partial<Sp>) => `/admin/super/vins?${new URLSearchParams(Object.entries({ q: sp.q, couleur: sp.couleur, statut: sp.statut, resto: sp.resto, cartes: sp.cartes, ...extra }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <Entete titre="Vins de la base" texte="Les vins (cuvées) de la base de Pat : nom, appellation, cépages, étiquette. Une étiquette ajoutée ici est reprise par les cartes des restaurants qui n’ont pas leur propre photo." />
      <form method="get" className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', padding: '14px 18px' }}>
        <div className="champ" style={{ flex: '1 1 220px' }}><label htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={sp.q ?? ''} placeholder="Vin, producteur ou appellation…" /></div>
        <div className="champ"><label htmlFor="couleur">Couleur</label>
          <select id="couleur" name="couleur" defaultValue={sp.couleur ?? ''}><option value="">Toutes</option>{Object.entries(COULEURS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="champ"><label htmlFor="statut">Statut</label>
          <select id="statut" name="statut" defaultValue={sp.statut ?? ''}><option value="">Tous</option><option value="propose">À valider</option><option value="valide">Validés</option><option value="retire">Retirés</option></select></div>
        <div className="champ"><label htmlFor="resto">Restaurant</label>
          <select id="resto" name="resto" defaultValue={sp.resto ?? ''}><option value="">Tous</option>{restos.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</select></div>
        <div className="champ"><label htmlFor="cartes">Vins</label>
          <select id="cartes" name="cartes" defaultValue={surCartes ? '' : '0'}><option value="">Sur une carte de restaurant</option><option value="0">Toute la base</option></select></div>
        <button className="btn petit">Filtrer</button>
      </form>

      {sp.vin && sp.ok && <RetourVin vinId={sp.vin} message={sp.ok} />}
      <div className="tableau">
        <table style={{ minWidth: 860 }}>
          <thead><tr><th>Vin</th><th>Producteur</th><th>Appellation</th><th>Cépages</th><th className="droite">Cartes</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {lignes.map((c) => {
              const fiche = `/admin/super/vins/${encodeURIComponent(c.id)}?${new URLSearchParams({ retour: ici })}`;
              return (
                <tr key={c.id} id={`vin-${c.id}`} className={c.id === sp.vin ? 'choisi' : ''} style={{ scrollMarginTop: 80 }}>
                  <td style={{ minWidth: 200 }}><div className="vin-cell"><Vignette url={c.etiquette_url} /><div><Link href={fiche} className="nom">{c.nom}</Link><div className="petit">{c.couleur ? COULEURS[c.couleur] : 'Couleur à préciser'}</div></div></div></td>
                  <td><Link href={`/admin/super/producteurs/${encodeURIComponent(c.producteur_id)}`}>{c.producteur}</Link></td>
                  <td>{c.appellation ?? '—'}</td>
                  <td className="petit" style={{ maxWidth: 160 }}>{c.cepages ?? '—'}</td>
                  <td className="droite">{c.sur_cartes || '—'}</td>
                  <td><Etat type={STATUT[c.statut]?.[1] ?? ''}>{STATUT[c.statut]?.[0] ?? c.statut}</Etat></td>
                  <td className="droite"><Link className="lien-ligne" href={fiche}>Ouvrir</Link></td>
                </tr>
              );
            })}
            {!lignes.length && <tr><td colSpan={7} className="discret">Aucun vin ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>
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
