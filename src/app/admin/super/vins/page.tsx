import Link from 'next/link';
import { Entete, Etat, Message, Vignette } from '@/components/admin/Ui';
import { nomsProducteurs, rechercherCuvees, restaurantsListe, vinsDeLaCarte } from '@/lib/super/donnees';
import { ajouterCuveeDepuisCarte, ajouterVinBase, validerCuvees } from '../actions';
import { BarreValidation, CocherTout } from '@/components/admin/ValidationGroupee';
import { etatEtiquetteBase, etatEtiquetteVin } from '@/lib/etiquettes/etat';
import { exigerAdmin } from '@/lib/admin/auth';
import { RetourVin } from '@/components/admin/RetourVin';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blanc', rose: 'Rosé', rouge: 'Rouge', orange: 'Orange', doux: 'Doux', sans_alcool: 'Sans alcool' };
const STATUT: Record<string, [string, 'ok' | 'propose' | 'defaut']> = { valide: ['Validé', 'ok'], propose: ['À valider', 'propose'], retire: ['Retiré', 'defaut'] };
/** Case à cocher d'un vin à valider (formulaire « valider-lot » de BarreValidation). */
const Case = ({ id, statut }: { id: string | null; statut: string | null }) =>
  <td style={{ width: 28 }}>{id && statut === 'propose' && <input type="checkbox" name="ids" value={id} form="valider-lot" aria-label="Sélectionner ce vin à valider" />}</td>;
/** Bouton « Valider » d'un vin à valider, sur sa ligne (sans ouvrir sa fiche). */
const ValiderIci = ({ id, retour }: { id: string; retour: string }) => (
  <form action={validerCuvees} style={{ display: 'inline-block' }}>
    <input type="hidden" name="ids" value={id} /><input type="hidden" name="retour" value={retour} />
    <button className="btn petit" title="Valider ce vin dans la base de Pat">Valider</button>
  </form>
);
type Sp = { q?: string; couleur?: string; statut?: string; resto?: string; cartes?: string; page?: string; vin?: string; ok?: string; erreur?: string };

/** Vins de la base de Pat (cuvées) : recherche, filtres, et accès à la fiche de chaque vin. */
export default async function VinsBase({ searchParams }: { searchParams: Promise<Sp> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page) || 0);
  const surCartes = sp.cartes !== '0';
  // Un restaurant choisi : tous les vins de sa carte, reliés ou non à un vin de la base.
  const [{ lignes, total }, carte, restos, producteurs] = await Promise.all([
    sp.resto ? { lignes: [], total: 0 } : rechercherCuvees({ texte: sp.q ?? '', couleur: sp.couleur ?? '', statut: sp.statut ?? '', surCartes, page }),
    sp.resto ? vinsDeLaCarte({ restaurant: sp.resto, texte: sp.q ?? '', couleur: sp.couleur ?? '', statut: sp.statut ?? '', page }) : null,
    restaurantsListe(), nomsProducteurs(),
  ]);
  const nombre = carte ? carte.total : total;
  // Adresse de la liste telle qu'affichée (filtres et page) : la fiche y ramène après une validation.
  const ici = `/admin/super/vins?${new URLSearchParams(Object.entries({ q: sp.q, couleur: sp.couleur, statut: sp.statut, resto: sp.resto, cartes: sp.cartes, page: sp.page }).filter(([, v]) => v) as [string, string][])}`;
  const lien = (extra: Partial<Sp>) => `/admin/super/vins?${new URLSearchParams(Object.entries({ q: sp.q, couleur: sp.couleur, statut: sp.statut, resto: sp.resto, cartes: sp.cartes, ...extra }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <Entete titre="Vins de la base" texte="Les vins (cuvées) de la base de Pat : nom, appellation, cépages, étiquette. Une étiquette ajoutée ici est reprise par les cartes des restaurants qui n’ont pas leur propre photo." />
      <Message erreur={sp.erreur} />
      {/* Nouveau vin de la base : validé, rattaché à un producteur de la base ; sa fiche s'ouvre ensuite (étiquette, garde…). */}
      <details className="carte-bo" style={{ padding: '14px 18px' }} open={Boolean(sp.erreur)}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>+ Ajouter un vin</summary>
        <form action={ajouterVinBase} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
          <div className="champ" style={{ flex: '2 1 240px' }}><label htmlFor="n-prod">Producteur</label>
            <input id="n-prod" name="producteur" list="liste-producteurs" required placeholder="Tapez pour chercher…" autoComplete="off" /></div>
          <div className="champ" style={{ flex: '2 1 220px' }}><label htmlFor="n-nom">Nom du vin</label><input id="n-nom" name="nom" required placeholder="Ex. Moulin-à-Vent Michelon" /></div>
          <div className="champ"><label htmlFor="n-couleur">Couleur</label>
            <select id="n-couleur" name="couleur" required defaultValue=""><option value="" disabled>Choisir…</option>{Object.entries(COULEURS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="champ" style={{ flex: '1 1 180px' }}><label htmlFor="n-app">Appellation</label><input id="n-app" name="appellation" placeholder="Moulin-à-Vent" /></div>
          <div className="champ" style={{ flex: '1 1 180px' }}><label htmlFor="n-cep">Cépages</label><input id="n-cep" name="cepages" placeholder="Gamay" /></div>
          <div className="champ"><label htmlFor="n-rk">Note du vin (0 à 5)</label><input id="n-rk" className="rk" name="ranking" type="number" min={0} max={5} step={1} placeholder="—" title="Vide : celle du producteur s’applique" /></div>
          <button className="btn petit">Ajouter</button>
          <datalist id="liste-producteurs">{producteurs.map((p, i) => <option key={i} value={p.region ? `${p.nom} · ${p.region}` : p.nom} />)}</datalist>
        </form>
        <p className="petit discret" style={{ margin: '8px 0 0' }}>Producteur absent de la liste : ajoutez-le d’abord dans le menu Producteurs. Note du vin vide : celle du producteur s’applique.</p>
      </details>

      <form method="get" className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', padding: '14px 18px' }}>
        <div className="champ" style={{ flex: '1 1 220px' }}><label htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={sp.q ?? ''} placeholder="Vin, producteur ou appellation…" /></div>
        <div className="champ"><label htmlFor="couleur">Couleur</label>
          <select id="couleur" name="couleur" defaultValue={sp.couleur ?? ''}><option value="">Toutes</option>{Object.entries(COULEURS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="champ"><label htmlFor="statut">Statut</label>
          <select id="statut" name="statut" defaultValue={sp.statut ?? ''}><option value="">Tous</option><option value="propose">À valider</option><option value="valide">Validés</option><option value="retire">Retirés</option>{sp.resto && <option value="absent">Pas encore dans la base</option>}</select></div>
        <div className="champ"><label htmlFor="resto">Restaurant</label>
          <select id="resto" name="resto" defaultValue={sp.resto ?? ''}><option value="">Tous</option>{restos.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</select></div>
        {!sp.resto && <div className="champ"><label htmlFor="cartes">Vins</label>
          <select id="cartes" name="cartes" defaultValue={surCartes ? '' : '0'}><option value="">Sur une carte de restaurant</option><option value="0">Toute la base</option></select></div>}
        <button className="btn petit">Filtrer</button>
      </form>

      {sp.ok && <RetourVin vinId={sp.vin ?? ''} message={sp.ok} />}
      <BarreValidation action={validerCuvees} retour={ici} />
      {carte ? (
        <div className="tableau">
          <table className="table-vins" style={{ minWidth: 820 }}>
            <thead><tr><th><CocherTout /></th><th>Vin de la carte</th><th>Producteur</th><th>Appellation</th><th>Cépages</th><th>Étiquette</th><th>Base de Pat</th><th /></tr></thead>
            <tbody>
              {carte.lignes.map((v) => (
                <tr key={v.id} id={`vin-${v.cuvee_id ?? v.id}`} className={(v.cuvee_id ?? v.id) === sp.vin ? 'choisi' : ''} style={{ scrollMarginTop: 80 }}>
                  <Case id={v.cuvee_id} statut={v.cuvee_statut} />
                  <td style={{ minWidth: 180 }}><div className="vin-cell"><Vignette url={v.etiquette_url} /><div><b>{v.cuvee_nom ?? v.libelle}</b>{v.millesime ? ` ${v.millesime}` : ''}<div className="petit">{COULEURS[v.couleur] ?? v.couleur}{v.cuvee_nom && v.cuvee_nom !== v.libelle ? ` · sur la carte : ${v.libelle}` : ''}{v.contenances ? ` · ${v.contenances}` : ''}</div></div></div></td>
                  <td>{v.producteur_id ? <Link href={`/admin/super/producteurs/${encodeURIComponent(v.producteur_id)}`}>{v.producteur}</Link> : (v.producteur ?? '—')}</td>
                  <td>{v.appellation ?? '—'}</td>
                  <td className="petit" style={{ maxWidth: 160 }}>{v.cepages ?? '—'}</td>
                  <td className="col-etiquette">{(() => { const [l, k] = etatEtiquetteVin(v, true); return <Etat type={k}>{l}</Etat>; })()}</td>
                  <td>{v.cuvee_statut ? <Etat type={STATUT[v.cuvee_statut]?.[1] ?? ''}>{STATUT[v.cuvee_statut]?.[0] ?? v.cuvee_statut}</Etat> : <Etat type="">Pas dans la base</Etat>}</td>
                  <td className="droite">
                    {v.cuvee_id ? <span className="ligne-actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', alignItems: 'center' }}>
                      {v.cuvee_statut === 'propose' && <ValiderIci id={v.cuvee_id} retour={ici} />}
                      <Link className="lien-ligne" href={`/admin/super/vins/${encodeURIComponent(v.cuvee_id)}?${new URLSearchParams({ retour: ici })}`}>Ouvrir</Link></span>
                      : v.producteur_id ? (
                        <form action={ajouterCuveeDepuisCarte.bind(null, v.id)}><input type="hidden" name="retour" value={ici} /><button className="btn sec petit" title="Ajouter ce vin à la base de Pat">Ajouter</button></form>
                      ) : <Link className="lien-ligne" href={`/admin/${sp.resto}/carte/${encodeURIComponent(v.id)}?${new URLSearchParams({ retour: ici })}`} title="Le vin doit d'abord être relié à un producteur">Relier</Link>}
                  </td>
                </tr>
              ))}
              {!carte.lignes.length && <tr><td colSpan={8} className="discret">Aucun vin ne correspond.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="tableau">
        <table className="table-vins" style={{ minWidth: 820 }}>
          <thead><tr><th><CocherTout /></th><th>Vin</th><th>Producteur</th><th>Appellation</th><th>Cépages</th><th className="droite">Cartes</th><th>Étiquette</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {lignes.map((c) => {
              const fiche = `/admin/super/vins/${encodeURIComponent(c.id)}?${new URLSearchParams({ retour: ici })}`;
              return (
                <tr key={c.id} id={`vin-${c.id}`} className={c.id === sp.vin ? 'choisi' : ''} style={{ scrollMarginTop: 80 }}>
                  <Case id={c.id} statut={c.statut} />
                  <td style={{ minWidth: 200 }}><div className="vin-cell"><Vignette url={c.etiquette_url} /><div><Link href={fiche} className="nom">{c.nom}</Link><div className="petit">{c.couleur ? COULEURS[c.couleur] : 'Couleur à préciser'}</div></div></div></td>
                  <td><Link href={`/admin/super/producteurs/${encodeURIComponent(c.producteur_id)}`}>{c.producteur}</Link></td>
                  <td>{c.appellation ?? '—'}</td>
                  <td className="petit" style={{ maxWidth: 160 }}>{c.cepages ?? '—'}</td>
                  <td className="droite">{c.sur_cartes || '—'}</td>
                  <td className="col-etiquette">{(() => { const [l, k] = etatEtiquetteBase(c); return <Etat type={k}>{l}</Etat>; })()}</td>
                  <td><Etat type={STATUT[c.statut]?.[1] ?? ''}>{STATUT[c.statut]?.[0] ?? c.statut}</Etat></td>
                  <td className="droite"><span className="ligne-actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', alignItems: 'center' }}>
                    {c.statut === 'propose' && <ValiderIci id={c.id} retour={ici} />}<Link className="lien-ligne" href={fiche}>Ouvrir</Link></span></td>
                </tr>
              );
            })}
            {!lignes.length && <tr><td colSpan={9} className="discret">Aucun vin ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>
      )}
      {nombre > 50 && (
        <div className="ligne-actions">
          {page > 0 && <Link href={lien({ page: String(page - 1) })} className="btn fantome petit">← Précédents</Link>}
          <span className="discret">{page * 50 + 1}–{Math.min(nombre, (page + 1) * 50)} sur {nombre.toLocaleString('fr-BE')}</span>
          {(page + 1) * 50 < nombre && <Link href={lien({ page: String(page + 1) })} className="btn fantome petit">Suivants →</Link>}
        </div>
      )}
    </>
  );
}
