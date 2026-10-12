import Link from 'next/link';
import { chercherEtiquettes, enregistrerOrdreCarte } from '../../actions';
import { TableCarteGlissable } from '@/components/admin/TableCarteGlissable';
import { identifiantsWineLabs } from '@/lib/etiquettes/wine-labs';
import { BoutonCarteImprimee } from '@/components/admin/BoutonCarteImprimee';
import { Entete, Etat, Message, Vignette, euros } from '@/components/admin/Ui';
import { utilisateurCourant, exigerAcces } from '@/lib/admin/auth';
import { getRankingsInternes, getRestaurantBO, getVinsBO, ligneNotesPat } from '@/lib/admin/donnees';
import { categoriesActives } from '@/lib/categories';
import { etatEtiquette, etatProducteur, nomPourListe, parRubrique, placeGroupe, regrouperVins } from './etats';
import { RetourVin } from '@/components/admin/RetourVin';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['rouge', 'Rouges'], ['orange', 'Orange'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']] as const;

export default async function Carte({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string; vin?: string; ok?: string; erreur?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [vins, u, restaurant] = await Promise.all([getVinsBO(resto), utilisateurCourant(), getRestaurantBO(resto)]);
  // Rankings : chargés seulement pour Pat (administrateur), jamais pour un compte restaurant.
  const rankings = u?.admin ? await getRankingsInternes(resto) : null;
  // Notes de Pat (base) : visibles par le super-admin seulement, jamais par le restaurant.
  const etoiles = (id: string) => ligneNotesPat(rankings?.get(id));
  // Onglets comme dans l'app : les couleurs, puis les catégories spéciales (coups de cœur, nature, bio) ;
  // un vin d'une catégorie spéciale n'est que là.
  const actives = categoriesActives(restaurant?.categories_carte);
  const tousGroupes = regrouperVins(vins);
  const placeDe = new Map(tousGroupes.map((g) => [g, placeGroupe(g, actives)]));
  const presentes: [string, string][] = [
    ...COULEURS.filter(([k]) => tousGroupes.some((g) => placeDe.get(g) === k)).map(([k, l]) => [k, l] as [string, string]),
    ...actives.filter((e) => tousGroupes.some((g) => placeDe.get(g) === e.id)).map((e) => [e.id, e.libelle] as [string, string]),
  ];
  const choisi = vins.find((v) => v.id === sp.vin); // vin dont on revient : mis en évidence
  const groupeChoisi = choisi && tousGroupes.find((g) => g.tous.includes(choisi));
  const c = sp.c ?? (groupeChoisi && placeDe.get(groupeChoisi)) ?? presentes[0]?.[0] ?? 'rouge';
  const special = actives.some((e) => e.id === c);
  const affiches = tousGroupes.filter((g) => placeDe.get(g) === c);
  const sansEtiquette = vins.filter((v) => !v.etiquette_url).length;
  const enRecherche = vins.filter((v) => !v.etiquette_url && (v.etiquette_statut === 'demandee' || v.etiquette_statut === 'a_demander')).length;
  // Chaque étiquette trouvée coûte un crédit Wine Labs à Pat : la recherche manuelle est réservée au super-admin.
  const aChercher = vins.filter((v) => !v.etiquette_url && !['a_demander', 'demandee', 'introuvable'].includes(v.etiquette_statut ?? '')).length;
  const introuvables = vins.filter((v) => !v.etiquette_url && v.etiquette_statut === 'introuvable').length;
  const wineLabs = Boolean(u?.admin); // super-admin seulement : les crédits sont ceux de Pat
  const pourquoiPas = !identifiantsWineLabs() ? 'Wine Labs n’est pas configuré sur le serveur (WINE_LABS_API_KEY)'
    : !aChercher && (sansEtiquette === 0 ? 'toutes les étiquettes sont là'
    : enRecherche ? `${enRecherche} déjà en recherche${introuvables ? `, ${introuvables} introuvable(s)` : ''}` : `${introuvables} introuvable(s) chez Wine Labs : à photographier`);
  return (
    <>
      <Entete titre="Carte des vins" texte="Chaque vin est relié à la base de producteurs et de terroirs de Pat. Corrigez un prix, une rupture ou une étiquette : l’app est à jour tout de suite.">
        <Link href={`/admin/${resto}/carte/nouveau?c=${c}`} className="btn">Ajouter un vin</Link>
        <BoutonCarteImprimee resto={resto} />
        <Link href={`/admin/${resto}/supports`} className="btn sec">Relire les présentations</Link>
        {wineLabs && (
          <form action={chercherEtiquettes.bind(null, resto)} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <button className="btn sec" disabled={!aChercher || !identifiantsWineLabs()} title="Une demande par cuvée ; seules les étiquettes trouvées coûtent un crédit">
              Chercher sur Wine Labs{aChercher ? ` (${aChercher})` : ''}</button>
            {pourquoiPas && <span className="petit discret">{identifiantsWineLabs() ? 'Rien à chercher : ' : ''}{pourquoiPas}.</span>}
          </form>
        )}
      </Entete>
      {choisi && sp.ok
        ? <RetourVin vinId={affiches.find((g) => g.tous.some((x) => x.id === choisi.id))?.principal.id ?? choisi.id} message={sp.ok} />
        : <Message ok={sp.ok === '1' ? 'Enregistré.' : sp.ok} erreur={sp.erreur} />}
      <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{vins.length}</div><span className="discret">références</span></div>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{vins.filter((v) => v.statut_producteur === 'reference').length}</div><span className="discret">vins reliés à un producteur de Pat</span></div>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{vins.length - sansEtiquette}</div><span className="discret">étiquettes</span></div>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre" style={{ color: 'var(--ocre)' }}>{sansEtiquette}</div><span className="discret">étiquettes manquantes</span>
          {sansEtiquette > 0 && <div className="petit">Pat les cherche ; vous pouvez aussi envoyer vos photos</div>}
</div>
      </div>
      <div className="rangee">
        <section className="large">
          <nav className="onglets" aria-label="Couleurs">
            {presentes.map(([k, l]) => (
              <Link key={k} href={`/admin/${resto}/carte?c=${k}`} aria-current={c === k ? 'true' : undefined}>{l} <span>{tousGroupes.filter((g) => placeDe.get(g) === k).length}</span></Link>
            ))}
          </nav>
          <div className="tableau">
            <table className="table-vins" style={{ minWidth: 880 }}>
              <thead><tr><th>Vin</th><th>Millésime</th><th>Producteur</th><th>Cépage</th><th>Contenances</th><th className="droite">Prix</th><th>Étiquette</th><th /></tr></thead>
              {/* Comme dans l'app : les sous-catégories de la carte (renommables), puis leurs vins (flèches pour les déplacer). */}
              {/* Catégorie spéciale : les vins groupés par couleur, comme dans l'app ; pas de sous-catégories à renommer ni d'ordre à régler ici. */}
              <TableCarteGlissable key={c} fixe={special} enregistrer={special ? undefined : enregistrerOrdreCarte.bind(null, resto, c)}
                rubriques={(special
                  ? COULEURS.map(([k, l]) => ({ nom: l as string, groupes: affiches.filter((g) => g.principal.couleur === k) })).filter((r) => r.groupes.length)
                  : parRubrique(affiches)).map((r, ri) => ({
                cle: `${ri}:${r.nom}`,
                nom: r.nom,
                // Catégorie spéciale : titre fixe (la couleur) ; sinon titre modifiable par le composant.
                entete: special ? (
                  <td colSpan={8}><b style={{ textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--bordeaux, #6b0f24)' }}>{r.nom}</b> <span className="petit discret">{r.groupes.length} vin{r.groupes.length > 1 ? 's' : ''}</span></td>
                ) : undefined,
                vins: r.groupes.map(({ principal: v, tous, contenances, prix }) => {
                  const [bl, bk] = etatProducteur(v);
                  const [el, ek] = etatEtiquette(v);
                  const nom = nomPourListe(v);
                  const fiche = `/admin/${resto}/carte/${encodeURIComponent(v.id)}`;
                  const choisie = tous.some((x) => x.id === choisi?.id);
                  return {
                    cle: v.id, ids: tous.map((x) => x.id), ancre: `vin-${v.id}`, classe: choisie ? 'choisi' : undefined,
                    cellules: (<>
                      <td style={{ minWidth: 170 }}><div className="vin-cell"><span aria-hidden="true" style={{ color: '#B5ADA8', fontSize: 16, marginRight: -4 }}>⋮⋮</span><Vignette url={v.etiquette_url} /><div><Link href={fiche} className="nom" draggable={false}>{nom[0]}</Link>{tous.some((x) => x.coup_de_coeur) && <span role="img" aria-label="Coup de cœur" title="Coup de cœur de la maison" style={{ marginLeft: 6, color: '#D7263D' }}>♥</span>}{nom.length > 1 && <div className="petit">{nom.slice(1).join(' · ')}</div>}{u?.admin && <div className="petit discret">{tous.map((x) => x.id).join(' · ')}</div>}</div></div></td>
                      <td>{v.millesime ?? '—'}</td>
                      <td className="col-producteur"><div>{v.producteur_nom ?? v.producteur_texte ?? '—'}</div><Etat type={bk}>{bl}</Etat>{rankings && <div className="petit" style={{ color: 'var(--bordeaux, #6b0f24)' }}>{etoiles(v.id)}</div>}</td>
                      <td className="petit" style={{ minWidth: 80, maxWidth: 120 }}>{v.cepages ?? '—'}</td>
                      <td>{contenances.length
                        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 110 }}>{contenances.map((x) => <Etat key={x} type="defaut">{x}</Etat>)}</div>
                        : <Etat type="attention">Indisponible</Etat>}</td>
                      <td className="droite" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{prix ? `${euros(prix.montant)}${prix.verre ? ' le verre' : ''}` : '—'}</td>
                      <td className="col-etiquette"><Etat type={ek}>{el}</Etat></td>
                    </>),
                    libelle: v.libelle,
                    fin: <Link className="lien-ligne" href={fiche} aria-label={`Modifier ${v.libelle}`} draggable={false}>Modifier</Link>,
                  };
                }),
              }))} />
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
