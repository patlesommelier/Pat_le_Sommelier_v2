// Base des vins — Vins : chaque vin de la carte sur une ligne, son stock (changé seulement dans la page Inventaire), ses bouteilles en commande (suivent les commandes),
// son fournisseur ; un point d’exclamation rouge signale un stock bas ; « + Panier » ajoute des bouteilles au panier de commande.
import { Fragment } from 'react';
import Link from 'next/link';
import { ajouterAuPanier, commanderPanier, enregistrerOrdreCave, enregistrerStocks, modifierPanier, viderPanier } from '../../stocks-actions';
import { TableCarteGlissable } from '@/components/admin/TableCarteGlissable';
import { AjoutPanier, Panier } from '@/components/admin/Panier';
import { offresPourLaCarte } from '@/lib/admin/distributeur-vin';
import { offresDistributeurs } from '@/lib/admin/recherche-base';
import { Superposition } from '@/components/admin/Superposition';
import { FormulaireAjoutVin } from './FormulaireAjoutVin';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { SelectFournisseur } from '@/components/admin/SelectFournisseur';
import { Entete, Message } from '@/components/admin/Ui';
import { requete } from '@/lib/db';
import { euros } from '@/lib/bon-commande';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { getCommandes, getFournisseurs, getPanier, getPrixAchat, stockBas } from '@/lib/admin/stocks';
import { nomPourListe, regrouperVins } from '../carte/etats';
import { VignetteVin } from '@/components/admin/VignetteVin';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['orange', 'Orange'], ['rouge', 'Rouges'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']] as const;

export default async function Stocks({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ filtre?: string; ajoute?: string; commander?: string; ok?: string; erreur?: string; ajout?: string; c?: string; distributeur?: string; nouveau?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const { filtre, ajoute, commander, ok, erreur, ajout, c, distributeur, nouveau } = await searchParams;
  const [vins, r, fournisseurs, ouvertes, achats, offres, panier] = await Promise.all([getVinsBO(resto), getRestaurantBO(resto), getFournisseurs(resto), getCommandes(resto, ['ouverte']), getPrixAchat(resto), offresPourLaCarte(resto), getPanier(resto)]);
  const auPanier = new Map(panier.map((l) => [l.vin_id, l.quantite]));
  const limite = r?.stock_limite_basse ?? 2;
  // Vins des distributeurs Quid Vinum : leur prix d'achat est celui du catalogue (prix public moins la remise du restaurant), non modifiable.
  const distributeursQv = new Set(fournisseurs.filter((f) => f.distributeur_id).map((f) => f.id));
  const prixCatalogue = new Map((await offresDistributeurs(resto, { vins: vins.map((v) => v.distributeur_vin_id).filter((x): x is string => Boolean(x)) }))
    .map((o) => [o.id, o.prix] as const).filter((x): x is readonly [string, number] => x[1] != null));
  const groupes = regrouperVins(vins).map((g) => ({ ...g, disponible: g.tous.some((x) => x.disponible) }))
    .map((g) => ({ ...g, bas: g.disponible && stockBas(g.principal.stock, limite) }));
  const bas = groupes.filter((g) => g.bas);
  // « Liste de vins » d'un distributeur (page Distributeurs) : seulement ses vins.
  const filtreDistributeur = distributeur ? fournisseurs.find((x) => x.id === distributeur) ?? null : null;
  const affiches = (filtre === 'bas' ? bas : groupes).filter((g) => !filtreDistributeur || g.tous.some((x) => x.fournisseur_id === filtreDistributeur.id));
  // Chaque vin dans la rubrique de sa couleur, qu'il soit sur la carte ou pas encore (sa ligne le dit).
  // Dans chaque couleur, le classement de la cave (à part de la carte) : ses sous-catégories et l'ordre choisi par le restaurant.
  const rang = (g: (typeof affiches)[number]) => Math.min(...g.tous.map((x) => x.cave_ordre ?? Number.MAX_SAFE_INTEGER));
  const parCouleur = COULEURS.map(([k, l]) => ({ cle: k as string, titre: l, groupes: affiches.filter((g) => g.principal.couleur === k)
    .map((g, i) => ({ g, i })).sort((a, b) => rang(a.g) - rang(b.g) || a.i - b.i).map(({ g }) => g) })).filter((c) => c.groupes.length);
  const rubriquesCave = (gs: typeof affiches) => {
    const out: { nom: string; groupes: typeof affiches }[] = [];
    for (const g of gs) { const nom = g.principal.cave_rubrique ?? g.tous.find((x) => x.cave_rubrique)?.cave_rubrique ?? '';
      const r = out.find((x) => x.nom === nom); if (r) r.groupes.push(g); else out.push({ nom, groupes: [g] }); }
    return out;
  };
  // Liste filtrée (stock bas, un distributeur) : on ne déplace pas les vins (le classement ne verrait qu'une partie de la cave).
  const fixe = filtre === 'bas' || Boolean(filtreDistributeur);
  const enCommande = groupes.reduce((n, g) => n + g.principal.en_commande, 0);
  // Valeur du stock au prix d'achat HTVA (vins sans prix d'achat : comptés à part).
  const valeur = groupes.reduce((n, g) => n + (achats.get(g.principal.id) ?? 0) * g.principal.stock, 0);
  const sansPrix = groupes.filter((g) => !achats.has(g.principal.id)).length;
  // Vin qui vient d'être ajouté depuis le catalogue d'un distributeur : la commande est proposée.
  const [ajouteChez] = ajoute && commander ? await requete<{ libelle: string; fournisseur_id: string; distributeur: string; prix_achat: number | null }>(
    `select v.libelle, v.fournisseur_id, f.nom as distributeur, v.prix_achat::float8 as prix_achat from vin_carte v join fournisseur f on f.id = v.fournisseur_id
      where v.restaurant_id = $1 and v.id = $2 and f.distributeur_id is not null`, [resto, ajoute]) : [];
  return (
    <>
      <Entete titre="Les vins" texte={`Vos vins : le nombre de bouteilles de chaque vin, en stock (à compter dans « Faire l’inventaire ») et en commande, son prix d’achat HTVA chez votre distributeur et son prix de vente TVAC sur votre carte. Un point d’exclamation rouge signale un stock bas : ${limite} bouteille${limite > 1 ? 's' : ''} ou moins (à régler dans Paramètres du restaurant).`}>
        {/* Fichier Excel des stocks (téléchargé) : vins, fournisseurs, prix, stock. */}
        {/* Ajout d'un vin dans une fenêtre en superposition (ouverte d'office par ?ajout=1). */}
        <Superposition bouton="+ Ajouter un vin" titre="Ajouter un vin" ouvert={ajout === '1'}>
          <FormulaireAjoutVin resto={resto} couleur={c} />
        </Superposition>
        {/* Le stock se change dans la page Inventaire (plus ici, à côté du prix de vente). */}
        <Link href={`/admin/${resto}/inventaire`} className="btn sec">Faire l’inventaire</Link>
        <a href={`/admin/${resto}/stocks/export`} className="btn sec" download>Exporter en Excel</a>
        {/* Panier : les bouteilles ajoutées ligne par ligne, commandées en une fois. */}
        <Panier lignes={panier} modifier={modifierPanier.bind(null, resto)} vider={viderPanier.bind(null, resto)} commander={commanderPanier.bind(null, resto)} />
      </Entete>
      {(erreur || (ok && !ajouteChez)) && <Message ok={ok} erreur={erreur} />}
      {nouveau && (() => { const n = vins.find((x) => x.id === nouveau); return n ? (
        <p className="message ok" style={{ margin: 0 }}>« {n.libelle} » est dans votre cave (en évidence ci-dessous) : indiquez le nombre de bouteilles et cliquez sur + 🛒 pour le commander.</p>) : null; })()}
      <p className="petit discret" style={{ margin: 0 }}>Cliquez sur un vin pour ouvrir sa fiche : description, stock, commande, suppression. Ce qui s’affiche sur votre carte se règle dans <Link href={`/admin/${resto}/carte`}>Gérer la carte des vins</Link>.</p>
      {ajouteChez && (
        <div className="carte-bo ligne-actions" style={{ alignItems: 'center', border: '1.5px solid var(--rouge)' }}>
          <span>{ok} <b>« {ajouteChez.libelle} »</b> est disponible chez <b>{ajouteChez.distributeur}</b>{ajouteChez.prix_achat != null ? ` à ${euros(ajouteChez.prix_achat)} HTVA` : ''}. Mettez-le au panier pour le commander :</span>
          <AjoutPanier ajouter={ajouterAuPanier.bind(null, resto, ajoute!)} libelle={ajouteChez.libelle} dansPanier={auPanier.get(ajoute!) ?? 0} />
          <Link href={`/admin/${resto}/stocks`} className="btn fantome petit">Fermer</Link>
        </div>
      )}
      <section className="stats" aria-label="Résumé des stocks">
        <div className="stat"><span className="chiffre" style={{ color: bas.length ? 'var(--rouge)' : undefined }}>{bas.length}</span><span>{bas.length > 1 ? 'vins en stock bas' : 'vin en stock bas'}</span></div>
        <div className="stat"><span className="chiffre">{groupes.reduce((n, g) => n + g.principal.stock, 0).toLocaleString('fr-BE')}</span><span>bouteilles en stock</span></div>
        <div className="stat"><span className="chiffre">{enCommande}</span><span>bouteilles en commande</span></div>
        <div className="stat"><span className="chiffre">{euros(valeur)}</span><span>valeur du stock HTVA{sansPrix ? ` (${sansPrix} vin${sansPrix > 1 ? 's' : ''} sans prix d’achat)` : ''}</span></div>
        <div className="stat"><span className="chiffre">{ouvertes.length}</span><span>{ouvertes.length > 1 ? 'commandes ouvertes' : 'commande ouverte'}</span></div>
      </section>
      {/* Enregistrement automatique : chaque chiffre ou distributeur changé est enregistré en quittant le champ. */}
      <FormulaireAdmin action={enregistrerStocks.bind(null, resto)} className="pile" auto>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <nav className="onglets" aria-label="Filtre">
            <Link href={`/admin/${resto}/stocks`} aria-current={filtre !== 'bas' ? 'true' : undefined}>Tous les vins <span>{groupes.length}</span></Link>
            <Link href={`/admin/${resto}/stocks?filtre=bas`} aria-current={filtre === 'bas' ? 'true' : undefined}>Stock bas <span>{bas.length}</span></Link>
          </nav>
          <span className="petit discret">Enregistré automatiquement à chaque changement.</span>
        </div>
        {filtreDistributeur && (
          <p className="ligne-actions" style={{ alignItems: 'center', margin: 0 }}>
            <span>Vins de <b>{filtreDistributeur.nom}</b> ({affiches.length})</span>
            <Link href={`/admin/${resto}/stocks${filtre === 'bas' ? '?filtre=bas' : ''}`} className="btn fantome petit">✕ Tous les distributeurs</Link>
          </p>
        )}
        {!affiches.length && <p className="discret">{filtre === 'bas' ? 'Aucun vin en stock bas.' : 'Aucun vin sur la carte.'}</p>}
        {parCouleur.length > 0 && (
          <div className="tableau">
            <table className="table-stocks" style={{ minWidth: 1060 }}>
              <thead><tr><th>Vin</th><th>À ma carte</th><th>Millésime</th><th>Distributeur</th><th className="droite">Achat HTVA</th><th className="droite">Vente TVAC</th><th className="droite">En stock</th><th className="droite">En commande</th><th>Panier</th></tr></thead>
              {parCouleur.map((c) => (
                <Fragment key={c.cle}>
                  <tbody><tr className="rubrique"><td colSpan={9}><b className="rubrique-carte">{c.titre}</b></td></tr></tbody>
                  {/* Sous-catégories de la cave (titre modifiable), vins à glisser ou à déplacer avec les flèches ↑ ↓ (à part de la carte). */}
                  <TableCarteGlissable key={`${c.cle}:${fixe}`} colonnes={9} apres="classement de votre cave enregistré" fixe={fixe}
                    enregistrer={fixe ? undefined : enregistrerOrdreCave.bind(null, resto, c.cle)}
                    rubriques={rubriquesCave(c.groupes).map((r, ri) => ({
                      cle: `${ri}:${r.nom}`, nom: r.nom,
                      // Liste filtrée : titres fixes (pas de renommage).
                      entete: fixe ? (r.nom ? <td colSpan={9}><b style={{ textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--encre)' }}>{r.nom}</b></td> : <td colSpan={9} style={{ padding: 0, border: 0 }} />) : undefined,
                      vins: r.groupes.map(({ principal: v, tous, disponible, bas: alerte }) => {
                        const nom = nomPourListe(v);
                        const nouv = Boolean(nouveau && tous.some((x) => x.id === nouveau));
                        return {
                          cle: v.id, ids: tous.map((x) => x.id), libelle: v.libelle,
                          // Vin qui vient d'être ajouté (« Rajouter un vin ») : ligne mise en évidence, la page s'y place (ancre).
                          ancre: nouv ? `vin-${nouveau}` : undefined,
                          classe: [disponible ? '' : 'indisponible', nouv ? 'ligne-nouvelle' : ''].filter(Boolean).join(' ') || undefined,
                          cellules: (<>
                        <td style={{ minWidth: 240 }}><div className="vin-cell">{!fixe && <span aria-hidden="true" style={{ color: '#AFB0AE', fontSize: 16, marginRight: -4, cursor: 'grab' }}>⋮⋮</span>}<VignetteVin url={v.etiquette_url} logo={v.logo_distributeur} taille={40} />
                          <div><div className="nom"><Link href={`/admin/${resto}/carte/${encodeURIComponent(v.id)}?${new URLSearchParams({ retour: `/admin/${resto}/stocks` })}`} className="lien-vin">{nom[0]}</Link></div>{nom.length > 1 && <div className="petit">{nom.slice(1).join(' · ')}</div>}{!disponible && <div className="petit discret">Pas sur votre carte</div>}
                          {/* Vin lu sur la carte : reconnu dans la base de Pat (ses données), ou en attente de validation (tel que lu). */}
                          {v.reconnaissance === 'reconnu' && <span className="pastille-reconnu" title="Vin reconnu dans la base de Pat : nom, producteur et appellation viennent de la base">✓ Reconnu</span>}
                          {v.reconnaissance === 'en_attente' && <span className="pastille-attente" title="Vin pas encore retrouvé dans la base de Pat : tel que lu sur votre carte, en attente de validation">En attente de validation</span>}
                          {/* Vendu par un distributeur de Quid Vinum (qui n'est pas encore son fournisseur) : pour information. */}
                          {offres.get(v.id) && (() => { const o = offres.get(v.id)!; return (
                            <div className="petit offre-qv">Disponible chez <b>{o.distributeur}</b>{o.prix != null ? ` · ${euros(o.prix)} HTVA` : ''}</div>); })()}
                          </div></div></td>
                        {/* À ma carte : le vin est proposé sur la carte des vins (app et carte imprimée) ; toutes ses contenances. */}
                        <td className="centre"><input type="hidden" name={`carte_envoye_${v.id}`} value="1" />
                          <input type="checkbox" name={`carte_${v.id}`} defaultChecked={disponible} className="case-carte" aria-label={`À ma carte : ${v.libelle}`} /></td>
                        {/* Millésime : une ligne par millésime d'un même vin ; modifiable ici (toutes ses contenances). */}
                        <td><input type="text" name={`millesime_${v.id}`} defaultValue={v.millesime ?? ''} placeholder="—" maxLength={20} className="champ-millesime" aria-label={`Millésime : ${v.libelle}`} /></td>
                        <td><SelectFournisseur nom={`fournisseur_${v.id}`} fournisseurs={fournisseurs} valeur={v.fournisseur_id} compact /></td>
                        {/* Distributeur Quid Vinum : prix de son catalogue pour ce restaurant, non modifiable. */}
                        <td className="droite">{v.fournisseur_id && distributeursQv.has(v.fournisseur_id)
                          ? <span className="prix-fixe" title="Prix du catalogue Quid Vinum">{(() => { const x = prixCatalogue.get(v.distributeur_vin_id ?? '') ?? achats.get(v.id); return x != null ? euros(x) : '—'; })()}<small>prix Quid Vinum</small></span>
                          : <span className="champ-prix"><input type="text" inputMode="decimal" name={`achat_${v.id}`} defaultValue={achats.has(v.id) ? achats.get(v.id)!.toFixed(2).replace('.', ',') : ''} placeholder="—" aria-label={`Prix d’achat HTVA : ${v.libelle}`} /> €</span>}</td>
                        {/* Prix de vente : celui de la bouteille sur la carte (app et carte imprimée), modifiable ici. */}
                        <td className="droite"><span className="champ-prix"><input type="text" inputMode="decimal" name={`vente_${v.id}`} defaultValue={v.prix != null ? Number(v.prix).toFixed(2).replace('.', ',') : ''} placeholder="—" aria-label={`Prix de vente TVAC : ${v.libelle}`} /> €</span>
                          {v.prix == null && v.prix_verre != null && <div className="petit discret">verre {Number(v.prix_verre).toFixed(2).replace('.', ',')} €</div>}</td>
                        <td className="droite"><span className="champ-stock">
                          {alerte && <span className="alerte-stock" role="img" aria-label="Stock bas" title="Stock bas">!</span>}
                          <input type="hidden" name={`ligne_${v.id}`} value="1" />
                          <Link href={`/admin/${resto}/inventaire`} className="stock-lecture" title="Le stock se change dans l’inventaire">{v.stock}</Link>
                        </span></td>
                        {/* En commande : suit les commandes passées (panier → Commander) et leur réception, jamais saisi à la main. */}
                        <td className="droite">{v.en_commande > 0
                          ? <Link href={`/admin/${resto}/commandes`} className="stock-lecture" title="Bouteilles commandées, pas encore reçues : voir les commandes">{v.en_commande}</Link>
                          : <span className="stock-lecture discret" title="Aucune bouteille en commande">0</span>}</td>
                          </>),
                          // Panier : un nombre de bouteilles, ajouté ligne par ligne (commandé ensuite depuis le panier, en haut).
                          fin: (
                        <AjoutPanier ajouter={ajouterAuPanier.bind(null, resto, v.id)} libelle={v.libelle} dansPanier={auPanier.get(v.id) ?? 0} champFournisseur={`fournisseur_${v.id}`} />
                          ),
                        };
                      }),
                    }))} />
                </Fragment>
              ))}
            </table>
          </div>
        )}
        <p className="petit discret" style={{ margin: 0 }}>Chaque changement est enregistré automatiquement. Le prix de vente TVAC est celui de la bouteille sur votre carte (app et carte imprimée).</p>
      </FormulaireAdmin>
    </>
  );
}
