// Catalogue d'un distributeur Quid Vinum (Base des vins — Distributeurs → « Catalogue ») : tous ses vins, prix public et prix du restaurant (sa remise en haut).
// Un vin peut être ajouté à « Vins » (pas encore sur la carte) ; il se commande ensuite avec le panier.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ajouterAuPanier, ajouterDuCatalogue } from '../../../stocks-actions';
import { AjoutCatalogue, AjoutPanier } from '@/components/admin/Panier';
import { Entete, Etat } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { euros } from '@/lib/bon-commande';
import { requete } from '@/lib/db';
import { catalogueDistributeur, distributeursProposes } from '@/lib/distributeurs/donnees';
import { VignetteVin } from '@/components/admin/VignetteVin';

const COULEURS: [string, string][] = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['orange', 'Orange'], ['rouge', 'Rouges'], ['doux', 'Doux']];
const PAR_PAGE = 120;
const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function Catalogue({ params, searchParams }: { params: Promise<{ resto: string; distributeur: string }>; searchParams: Promise<{ q?: string; c?: string; n?: string }> }) {
  const { resto, distributeur } = await params;
  await exigerAcces(resto);
  const sp = await searchParams;
  const d = (await distributeursProposes(resto)).find((x) => x.id === distributeur);
  if (!d) notFound();
  const tous = await catalogueDistributeur(distributeur, resto);
  // Vins du catalogue déjà dans les vins du restaurant, et leurs bouteilles au panier.
  const dansVins = new Map((await requete<{ distributeur_vin_id: string; id: string; panier: number }>(
    `select distinct on (v.distributeur_vin_id) v.distributeur_vin_id, v.id, coalesce(p.quantite, 0) as panier
       from vin_carte v left join panier p on p.restaurant_id = v.restaurant_id and p.vin_id = v.id
      where v.restaurant_id = $1 and v.distributeur_vin_id = any($2) order by v.distributeur_vin_id, v.disponible desc`, [resto, tous.map((v) => v.id)]))
    .map((x) => [x.distributeur_vin_id, x]));
  const q = sansAccents(sp.q?.trim() ?? '');
  const filtres = tous.filter((v) => (!sp.c || v.couleur === sp.c)
    && (!q || sansAccents(`${v.producteur ?? ''} ${v.libelle} ${v.millesime ?? ''} ${v.section ?? ''} ${v.reference ?? ''}`).includes(q)));
  const n = Math.max(PAR_PAGE, Number(sp.n) || PAR_PAGE);
  const affiches = filtres.slice(0, n);
  const lien = (x: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ q: sp.q, c: sp.c, ...x }).filter((e): e is [string, string] => Boolean(e[1])))}`;
  const site = d.site ? (/^https?:\/\//i.test(d.site) ? d.site : `https://${d.site}`) : null;

  return (
    <>
      <Entete titre={`Catalogue ${d.nom}`} texte="Tous les vins de ce distributeur : son prix public et votre prix, avec votre remise, comme en direct. Ajoutez un vin à Ma cave avec « + » (il n’est pas encore sur votre carte) : il se commande ensuite avec le panier.">
        <Link href={`/admin/${resto}/fournisseurs`} className="btn fantome">← Distributeurs</Link>
        <Link href={`/admin/${resto}/stocks`} className="btn sec">Ma cave et panier</Link>
      </Entete>
      {/* Remise du restaurant chez ce distributeur, bien visible en haut du catalogue. */}
      <div className="ligne-actions" style={{ alignItems: 'center' }}>
        {d.remise > 0
          ? <span className="remise-qv"><b>−{String(d.remise).replace('.', ',')} %</b> de remise sur le prix public</span>
          : <span className="remise-qv sans">Prix public, sans remise</span>}
      </div>
      {(d.presentation || site) && <p className="petit" style={{ margin: 0 }}>{d.presentation}{site && <>{d.presentation ? ' ' : ''}<a href={site} target="_blank" rel="noopener">Voir le site →</a></>}</p>}
      <form className="ligne-actions" style={{ alignItems: 'center' }}>
        <input name="q" type="search" defaultValue={sp.q ?? ''} placeholder="Chercher un vin, un domaine, une appellation…" aria-label="Chercher dans le catalogue" className="recherche" style={{ flex: '1 1 280px' }} />
        {sp.c && <input type="hidden" name="c" value={sp.c} />}
        <button className="btn sec">Chercher</button>
      </form>
      <nav className="onglets" aria-label="Couleur">
        <Link href={lien({ c: undefined, n: undefined })} aria-current={!sp.c ? 'true' : undefined}>Tous <span>{tous.length}</span></Link>
        {COULEURS.map(([k, l]) => { const nb = tous.filter((v) => v.couleur === k).length; return nb ? (
          <Link key={k} href={lien({ c: k, n: undefined })} aria-current={sp.c === k ? 'true' : undefined}>{l} <span>{nb}</span></Link>) : null; })}
      </nav>
      {!filtres.length && <p className="discret">Aucun vin ne correspond.</p>}
      {affiches.length > 0 && (
        <div className="tableau">
          <table className="table-stocks" style={{ minWidth: 760 }}>
            <thead><tr><th>Vin</th><th className="droite">Prix public HTVA</th><th className="droite">Votre prix HTVA{d.remise > 0 ? ` (−${String(d.remise).replace('.', ',')} %)` : ''}</th><th className="centre">Ajouter à Ma cave</th></tr></thead>
            <tbody>
              {affiches.map((v) => {
                const x = dansVins.get(v.id);
                return (
                  <tr key={v.id} className={v.epuise ? 'indisponible' : undefined}>
                    <td><div className="vin-cell"><VignetteVin url={v.etiquette_url} logo={d.logo_url} taille={40} />
                      <div><div className="nom">{v.libelle}{v.millesime && !v.libelle.includes(v.millesime) ? ` ${v.millesime}` : ''}</div>
                        <div className="petit">{[v.producteur, v.section, v.contenance, v.certification, v.reference ? `réf. ${v.reference}` : null].filter(Boolean).join(' · ')}</div>
                        {v.epuise && <Etat type="defaut">Épuisé</Etat>}</div></div></td>
                    <td className="droite discret" style={{ whiteSpace: 'nowrap', textDecoration: d.remise > 0 && v.prix_public != null ? 'line-through' : undefined }}>{v.prix_public != null ? euros(v.prix_public) : '—'}</td>
                    <td className="droite" style={{ whiteSpace: 'nowrap' }}><b>{v.prix != null ? euros(v.prix) : '—'}</b></td>
                    <td className="centre">{x
                      ? <span className="pile" style={{ gap: 4 }}><Link href={`/admin/${resto}/carte/${encodeURIComponent(x.id)}?${new URLSearchParams({ retour: `/admin/${resto}/fournisseurs/${distributeur}` })}`} className="petit">✓ Dans Ma cave</Link>
                          {!v.epuise && <AjoutPanier ajouter={ajouterAuPanier.bind(null, resto, x.id)} libelle={v.libelle} dansPanier={x.panier} />}</span>
                      : <AjoutCatalogue ajouter={ajouterDuCatalogue.bind(null, resto, distributeur, v.id)} libelle={v.libelle} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtres.length > affiches.length && <Link href={lien({ n: String(n + PAR_PAGE) })} className="btn sec" scroll={false}>Voir plus de vins ({filtres.length - affiches.length} autres)</Link>}
    </>
  );
}
