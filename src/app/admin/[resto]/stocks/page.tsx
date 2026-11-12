// Base des vins — Vins : chaque vin de la carte sur une ligne, son stock (changé seulement dans la page Inventaire), ses bouteilles en commande (suivent les commandes),
// son fournisseur ; un point d’exclamation rouge signale un stock bas ; « + Panier » ajoute des bouteilles au panier de commande.
import { exigerCave } from '@/lib/admin/garde-cave';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ajouterAuPanier, commanderPanier, enregistrerOrdreCave, enregistrerStocks, modifierPanier, viderPanier } from '../../stocks-actions';
import { TableCarteGlissable } from '@/components/admin/TableCarteGlissable';
import { AjoutPanier, Panier } from '@/components/admin/Panier';
import { offresPourLaCarte } from '@/lib/admin/distributeur-vin';
import { offresDistributeurs } from '@/lib/admin/recherche-base';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { SelectFournisseur } from '@/components/admin/SelectFournisseur';
import { Entete, Message } from '@/components/admin/Ui';
import { requete } from '@/lib/db';
import { euros } from '@/lib/bon-commande';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { getCommandes, getFournisseurs, getPanier, getPrixAchat, stockBas } from '@/lib/admin/stocks';
import { nomPourListe, regrouperVins } from '../carte/etats';
import { VignetteVin } from '@/components/admin/VignetteVin';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['orange', 'Orange'], ['rouge', 'Rouges'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']] as const;

export default async function Stocks({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ filtre?: string; ajoute?: string; commander?: string; ok?: string; erreur?: string; ajout?: string; c?: string; distributeur?: string; nouveau?: string }> }) {
  const { resto } = await params;
  const u = await exigerCave(resto);
  // Le restaurant est venu voir sa cave : le post-it 4 « Gérez votre cave » a fait son travail.
  if (!u.admin) await requete('update restaurant set cave_annonce_fermee_le = now() where id = $1 and cave_annonce_fermee_le is null', [resto]);
  const { filtre, ajoute, commander, ok, erreur, ajout, distributeur, nouveau } = await searchParams;
  if (ajout === '1') redirect(`/admin/${resto}/trouver-vin`); // anciens liens (?ajout=1) : la page Ajouter un vin
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
  // Classement de la cave (à part de la carte) : des catégories (au départ, les couleurs ; renommables, ex. par région),
  // chacune avec ses vins sans sous-catégorie puis ses sous-catégories. Un vin jamais classé va dans la catégorie de sa couleur.
  type G = (typeof affiches)[number];
  const premier = <T,>(g: G, f: (x: G['principal']) => T | null) => f(g.principal) ?? g.tous.map(f).find((x) => x != null) ?? null;
  const couleurIdx = (g: G) => { const i = COULEURS.findIndex(([k]) => k === g.principal.couleur); return i < 0 ? COULEURS.length : i; };
  const cle = (g: G, i: number): number[] => {
    const ordre = Math.min(...g.tous.map((x) => x.cave_ordre ?? Number.MAX_SAFE_INTEGER));
    return premier(g, (x) => x.cave_categorie) != null ? [0, ordre, i] : [1, couleurIdx(g), ordre, i];
  };
  const tries = affiches.map((g, i) => ({ g, k: cle(g, i) })).sort((x, y) => { for (let n = 0; n < 4; n++) { const d = (x.k[n] ?? 0) - (y.k[n] ?? 0); if (d) return d; } return 0; }).map((x) => x.g);
  const categories: { nom: string; rubriques: { nom: string; groupes: G[] }[] }[] = [];
  for (const g of tries) {
    const nomCat = premier(g, (x) => x.cave_categorie) ?? COULEURS.find(([k]) => k === g.principal.couleur)?.[1] ?? 'Autres';
    const nomRub = premier(g, (x) => x.cave_rubrique) ?? '';
    let c = categories.find((x) => x.nom === nomCat); if (!c) categories.push(c = { nom: nomCat, rubriques: [{ nom: '', groupes: [] }] });
    let r = c.rubriques.find((x) => x.nom === nomRub); if (!r) c.rubriques.push(r = { nom: nomRub, groupes: [] });
    r.groupes.push(g);
  }
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
      <Entete titre="Ma cave" texte={`Vos vins : le nombre de bouteilles de chaque vin, en stock (à compter dans « Faire l’inventaire ») et en commande, son prix d’achat HTVA chez votre distributeur et son prix de vente TVAC sur votre carte. Un point d’exclamation rouge signale un stock bas : ${limite} bouteille${limite > 1 ? 's' : ''} ou moins (à régler dans Paramètres du restaurant).`}>
        {/* Fichier Excel des stocks (téléchargé) : vins, fournisseurs, prix, stock. */}
        {/* « + Ajouter un vin » : la page Ajouter un vin (chercher dans la base, chez un distributeur, ou à la main). */}
        <Link href={`/admin/${resto}/trouver-vin`} className="btn">+ Ajouter un vin</Link>
        {/* Le stock se change dans la page Inventaire (plus ici, à côté du prix de vente). */}
        <Link href={`/admin/${resto}/inventaire`} className="btn sec">Faire l’inventaire</Link>
        <a href={`/admin/${resto}/stocks/export`} className="btn sec" download>Exporter en Excel</a>
        {/* Panier : les bouteilles ajoutées ligne par ligne, commandées en une fois. */}
        <Panier lignes={panier} modifier={modifierPanier.bind(null, resto)} vider={viderPanier.bind(null, resto)} commander={commanderPanier.bind(null, resto)} />
      </Entete>
      {(erreur || (ok && !ajouteChez)) && <Message ok={ok} erreur={erreur} />}
      {nouveau && (() => { const n = vins.find((x) => x.id === nouveau); return n ? (
        <p className="message ok" style={{ margin: 0 }}>« {n.libelle} » est dans Ma cave (en évidence ci-dessous) : indiquez le nombre de bouteilles et cliquez sur + 🛒 pour le commander.</p>) : null; })()}
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
        <div className="stat"><span className="chiffre">{ouvertes.length}</span><span>{ouvertes.length > 1 ? 'commandes en cours' : 'commande en cours'}</span></div>
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
        {categories.length > 0 && (
          <div className="tableau">
            <table className="table-stocks" style={{ minWidth: 1060 }}>
              <thead><tr><th>Vin</th><th>Sur ma carte</th><th>Millésime</th><th>Distributeur</th><th className="droite">Achat HTVA</th><th className="droite">Vente TVAC</th><th className="droite">En stock</th><th className="droite">En commande</th><th>Ajouter au panier</th></tr></thead>
              {/* Catégories et sous-catégories de la cave (titres modifiables), vins à glisser ou à déplacer avec les flèches ↑ ↓ (à part de la carte). */}
              <TableCarteGlissable key={String(fixe)} colonnes={9} apres="classement de Ma cave enregistré" fixe={fixe}
                    enregistrer={fixe ? undefined : enregistrerOrdreCave.bind(null, resto)}
                    rubriques={categories.flatMap((c, ci) => c.rubriques.filter((r, ri) => ri === 0 || r.groupes.length).map((r, ri) => ({ ...r, categorie: ri === 0, cle: `${ci}:${ri}:${c.nom}:${r.nom}`, nomAffiche: ri === 0 ? c.nom : r.nom }))).map((r) => ({
                      cle: r.cle, nom: r.nomAffiche, categorie: r.categorie,
                      // Liste filtrée : titres fixes (pas de renommage).
                      entete: fixe ? (r.categorie ? <td colSpan={9}><b className="rubrique-carte">{r.nomAffiche}</b></td>
                        : <td colSpan={9}><b style={{ textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--encre)' }}>{r.nomAffiche}</b></td>) : undefined,
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
                          {v.reconnaissance === 'reconnu' && <span className="pastille-reconnu" title="Vin vérifié par Quid Vinum : nom, producteur et appellation viennent de ses vins connus">✓ Vérifié</span>}
                          {v.reconnaissance === 'en_attente' && <span className="pastille-attente" title="Vin tel que lu sur votre carte : Quid Vinum est en train de le vérifier">Vérification en cours par Quid Vinum</span>}
                          {/* Vendu par un distributeur de Quid Vinum (qui n'est pas encore son fournisseur) : pour information. */}
                          {offres.get(v.id) && (() => { const o = offres.get(v.id)!; return (
                            <div className="petit offre-qv">Disponible chez <b>{o.distributeur}</b>{o.prix != null ? ` · ${euros(o.prix)} HTVA` : ''}</div>); })()}
                          </div></div></td>
                        {/* À ma carte : le vin est proposé sur la carte des vins (app et carte imprimée) ; toutes ses contenances. */}
                        <td className="centre"><input type="hidden" name={`carte_envoye_${v.id}`} value="1" />
                          <input type="checkbox" name={`carte_${v.id}`} defaultChecked={disponible} className="case-carte" aria-label={`Sur ma carte : ${v.libelle}`} /></td>
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
            </table>
          </div>
        )}
        <p className="petit discret" style={{ margin: 0 }}>Chaque changement est enregistré automatiquement. Le prix de vente TVAC est celui de la bouteille sur votre carte (app et carte imprimée).</p>
      </FormulaireAdmin>
    </>
  );
}
