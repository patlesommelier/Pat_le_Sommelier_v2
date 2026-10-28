// Gestion des stocks — Stocks : chaque vin de la carte sur une ligne, son stock et ses bouteilles en commande (modifiables),
// son fournisseur ; un point d'exclamation rouge signale un stock bas, avec un bouton pour commander.
import Link from 'next/link';
import { enregistrerStocks } from '../../stocks-actions';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { SelectFournisseur } from '@/components/admin/SelectFournisseur';
import { Entete, Vignette } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { getCommandes, getFournisseurs, stockBas } from '@/lib/admin/stocks';
import { nomPourListe, regrouperVins } from '../carte/etats';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['orange', 'Orange'], ['rouge', 'Rouges'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']] as const;

export default async function Stocks({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ filtre?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const { filtre } = await searchParams;
  const [vins, r, fournisseurs, ouvertes] = await Promise.all([getVinsBO(resto), getRestaurantBO(resto), getFournisseurs(resto), getCommandes(resto, ['ouverte'])]);
  const limite = r?.stock_limite_basse ?? 2;
  const groupes = regrouperVins(vins).map((g) => ({ ...g, disponible: g.tous.some((x) => x.disponible) }))
    .map((g) => ({ ...g, bas: g.disponible && stockBas(g.principal.stock, limite) }));
  const bas = groupes.filter((g) => g.bas);
  const affiches = filtre === 'bas' ? bas : groupes;
  const parCouleur = COULEURS.map(([k, l]) => ({ titre: l, groupes: affiches.filter((g) => g.principal.couleur === k) })).filter((c) => c.groupes.length);
  const enCommande = groupes.reduce((n, g) => n + g.principal.en_commande, 0);
  return (
    <>
      <Entete titre="Stocks" texte={`Le nombre de bouteilles de chaque vin, en stock et en commande. Un point d’exclamation rouge signale un stock bas : ${limite} bouteille${limite > 1 ? 's' : ''} ou moins (à régler dans Paramètres).`}>
        <Link href={`/admin/${resto}/commandes#nouvelle`} className="btn rouge">Commander du vin</Link>
      </Entete>
      <section className="stats" aria-label="Résumé des stocks">
        <div className="stat"><span className="chiffre" style={{ color: bas.length ? 'var(--rouge)' : undefined }}>{bas.length}</span><span>{bas.length > 1 ? 'vins en stock bas' : 'vin en stock bas'}</span></div>
        <div className="stat"><span className="chiffre">{groupes.reduce((n, g) => n + g.principal.stock, 0).toLocaleString('fr-BE')}</span><span>bouteilles en stock</span></div>
        <div className="stat"><span className="chiffre">{enCommande}</span><span>bouteilles en commande</span></div>
        <div className="stat"><span className="chiffre">{ouvertes.length}</span><span>{ouvertes.length > 1 ? 'commandes ouvertes' : 'commande ouverte'}</span></div>
      </section>
      <FormulaireAdmin action={enregistrerStocks.bind(null, resto)} className="pile">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <nav className="onglets" aria-label="Filtre">
            <Link href={`/admin/${resto}/stocks`} aria-current={filtre !== 'bas' ? 'true' : undefined}>Tous les vins <span>{groupes.length}</span></Link>
            <Link href={`/admin/${resto}/stocks?filtre=bas`} aria-current={filtre === 'bas' ? 'true' : undefined}>Stock bas <span>{bas.length}</span></Link>
          </nav>
          <button className="btn">Enregistrer les stocks</button>
        </div>
        {!affiches.length && <p className="discret">{filtre === 'bas' ? 'Aucun vin en stock bas.' : 'Aucun vin sur la carte.'}</p>}
        {parCouleur.length > 0 && (
          <div className="tableau">
            <table className="table-stocks" style={{ minWidth: 860 }}>
              <thead><tr><th>Vin</th><th>Fournisseur</th><th className="droite">En stock</th><th className="droite">En commande</th><th /></tr></thead>
              {parCouleur.map((c) => (
                <tbody key={c.titre}>
                  <tr className="rubrique"><td colSpan={5}><b className="rubrique-carte">{c.titre}</b></td></tr>
                  {c.groupes.map(({ principal: v, disponible, bas: alerte }) => {
                    const nom = nomPourListe(v);
                    return (
                      <tr key={v.id} className={disponible ? undefined : 'indisponible'}>
                        <td style={{ minWidth: 240 }}><div className="vin-cell"><Vignette url={v.etiquette_url} taille={40} />
                          <div><div className="nom">{nom[0]}{v.millesime ? ` ${v.millesime}` : ''}</div>{nom.length > 1 && <div className="petit">{nom.slice(1).join(' · ')}</div>}{!disponible && <div className="petit discret">Indisponible sur la carte</div>}</div></div></td>
                        <td><SelectFournisseur nom={`fournisseur_${v.id}`} fournisseurs={fournisseurs} valeur={v.fournisseur_id} compact /></td>
                        <td className="droite"><span className="champ-stock">
                          {alerte && <span className="alerte-stock" role="img" aria-label="Stock bas" title="Stock bas">!</span>}
                          <input type="number" name={`stock_${v.id}`} defaultValue={v.stock} min={0} max={100000} aria-label={`Bouteilles en stock : ${v.libelle}`} />
                        </span></td>
                        <td className="droite"><input type="number" name={`en_commande_${v.id}`} defaultValue={v.en_commande} min={0} max={100000} aria-label={`Bouteilles en commande : ${v.libelle}`} className="champ-commande" /></td>
                        <td>{alerte && <Link href={`/admin/${resto}/commandes?f=${v.fournisseur_id ?? 'aucun'}&vin=${encodeURIComponent(v.id)}#nouvelle`} className="btn rouge petit" style={{ whiteSpace: 'nowrap' }}>Commander</Link>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        <div className="barre-enregistrer"><span className="discret">Changez les chiffres puis enregistrez. À la réception d’une commande, les bouteilles passent toutes seules en stock.</span><button className="btn">Enregistrer les stocks</button></div>
      </FormulaireAdmin>
    </>
  );
}
