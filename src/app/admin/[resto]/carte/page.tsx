import Link from 'next/link';
import { chercherEtiquettes } from '../../actions';
import { identifiantsWineLabs } from '@/lib/etiquettes/wine-labs';
import { BoutonCarteImprimee } from '@/components/admin/BoutonCarteImprimee';
import { Entete, Etat, Message, Vignette, euros } from '@/components/admin/Ui';
import { utilisateurCourant, exigerAcces } from '@/lib/admin/auth';
import { getRankingsInternes, getVinsBO } from '@/lib/admin/donnees';
import { etatEtiquette, etatProducteur, nomPourListe, regrouperVins } from './etats';
import { RetourVin } from '@/components/admin/RetourVin';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['rouge', 'Rouges'], ['orange', 'Orange'], ['doux', 'Doux']] as const;

export default async function Carte({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string; vin?: string; ok?: string; erreur?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [vins, u] = await Promise.all([getVinsBO(resto), utilisateurCourant()]);
  // Rankings : chargés seulement pour Pat (administrateur), jamais pour un compte restaurant.
  const rankings = u?.admin ? await getRankingsInternes(resto) : null;
  const etoiles = (id: string) => { const r = rankings?.get(id); return r ? ` · ★ ${r.ranking_producteur ?? 0} / terroir ${r.ranking_terroir ?? 0}` : ''; };
  const presentes = COULEURS.filter(([k]) => vins.some((v) => v.couleur === k));
  const choisi = vins.find((v) => v.id === sp.vin); // vin dont on revient : mis en évidence
  const c = sp.c ?? choisi?.couleur ?? presentes[0]?.[0] ?? 'rouge';
  const affiches = regrouperVins(vins.filter((v) => v.couleur === c));
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
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre" style={{ color: 'var(--ocre)' }}>{sansEtiquette}</div><span className="discret">étiquettes à photographier</span>
          {enRecherche > 0 && <div className="petit">{enRecherche} en recherche chez Wine Labs</div>}
</div>
      </div>
      <div className="rangee">
        <section className="large">
          <nav className="onglets" aria-label="Couleurs">
            {presentes.map(([k, l]) => (
              <Link key={k} href={`/admin/${resto}/carte?c=${k}`} aria-current={c === k ? 'true' : undefined}>{l} <span>{regrouperVins(vins.filter((v) => v.couleur === k)).length}</span></Link>
            ))}
          </nav>
          <div className="tableau">
            <table className="table-vins" style={{ minWidth: 880 }}>
              <thead><tr><th>Vin</th><th>Millésime</th><th>Producteur</th><th>Cépage</th><th>Contenances</th><th className="droite">Prix</th><th>Étiquette</th><th /></tr></thead>
              <tbody>
                {affiches.map(({ principal: v, tous, contenances, prix }) => {
                  const [bl, bk] = etatProducteur(v);
                  const [el, ek] = etatEtiquette(v);
                  const nom = nomPourListe(v);
                  const fiche = `/admin/${resto}/carte/${encodeURIComponent(v.id)}`;
                  const choisie = tous.some((x) => x.id === choisi?.id);
                  return (
                    <tr key={v.id} id={`vin-${v.id}`} className={choisie ? 'choisi' : ''} style={{ scrollMarginTop: 80 }}>
                      <td style={{ minWidth: 170 }}><div className="vin-cell"><Vignette url={v.etiquette_url} /><div><Link href={fiche} className="nom">{nom[0]}</Link>{nom.length > 1 && <div className="petit">{nom.slice(1).join(' · ')}</div>}<div className="petit discret">{tous.map((x) => x.id).join(' · ')}</div></div></div></td>
                      <td>{v.millesime ?? '—'}</td>
                      <td className="col-producteur"><div>{v.producteur_nom ?? v.producteur_texte ?? '—'}</div><Etat type={bk}>{bl}</Etat>{rankings && <div className="petit">{etoiles(v.id).slice(3)}</div>}</td>
                      <td className="petit" style={{ minWidth: 80, maxWidth: 120 }}>{v.cepages ?? '—'}</td>
                      <td>{contenances.length
                        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 110 }}>{contenances.map((x) => <Etat key={x} type="defaut">{x}</Etat>)}</div>
                        : <Etat type="attention">Indisponible</Etat>}</td>
                      <td className="droite" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{prix ? `${euros(prix.montant)}${prix.verre ? ' le verre' : ''}` : '—'}</td>
                      <td className="col-etiquette"><Etat type={ek}>{el}</Etat></td>
                      <td className="droite"><Link className="lien-ligne" href={fiche} aria-label={`Modifier ${v.libelle}`}>Modifier</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
