import Link from 'next/link';
import { chercherEtiquettes, enregistrerVin, supprimerVin } from '../../actions';
import { BoutonConfirmation } from '@/components/admin/BoutonConfirmation';
import { identifiantsWineLabs } from '@/lib/etiquettes/wine-labs';
import { BoutonCarteImprimee } from '@/components/admin/BoutonCarteImprimee';
import { Entete, Etat, Message, Vignette, euros } from '@/components/admin/Ui';
import { utilisateurCourant, exigerAcces } from '@/lib/admin/auth';
import { getRankingsInternes, getVinsBO, suggestionsProducteurs, type VinBO } from '@/lib/admin/donnees';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['rouge', 'Rouges'], ['orange', 'Orange'], ['doux', 'Doux']] as const;
const BARRES = [['corps', 'Corps'], ['intensite', 'Intensité'], ['tanins', 'Tanins'], ['acidite', 'Acidité'], ['douceur', 'Douceur'], ['boise', 'Boisé']] as const;

function etiquette(v: VinBO): [string, 'ok' | 'propose' | 'attention' | ''] {
  if (v.etiquette_source === 'restaurant') return ['Votre photo', 'propose'];
  if (v.etiquette_source === 'wine_labs') return ['Wine Labs', 'ok'];
  if (v.etiquette_source === 'cuvee') return ['Base de Pat', 'ok'];
  if (v.etiquette_url) return ['Fournie', 'ok'];
  if (v.etiquette_statut === 'demandee' || v.etiquette_statut === 'a_demander') return ['Recherche Wine Labs…', ''];
  if (v.etiquette_statut === 'echec') return ['Échec Wine Labs : à photographier', 'attention'];
  if (v.etiquette_statut === 'introuvable') return ['Introuvable chez Wine Labs : à photographier', 'attention'];
  return ['À photographier', 'attention'];
}

function producteur(v: VinBO): [string, 'ok' | 'propose' | 'attention' | ''] {
  // Les rankings de Pat restent internes : le restaurant voit seulement si le producteur est déjà référencé ou nouveau.
  if (v.statut_producteur === 'nouveau') return ['Nouveau producteur', 'propose'];
  if (v.statut_producteur === 'reference') return ['Déjà référencé', 'ok'];
  if (v.producteur_texte && !/^non /i.test(v.producteur_texte)) return ['À relier : choisir le producteur', 'attention'];
  return ['Producteur à préciser', 'attention'];
}

export default async function Carte({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string; vin?: string; ok?: string; erreur?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [vins, u] = await Promise.all([getVinsBO(resto), utilisateurCourant()]);
  // Rankings : chargés seulement pour Pat (administrateur), jamais pour un compte restaurant.
  const rankings = u?.admin ? await getRankingsInternes(resto) : null;
  const etoiles = (id: string) => { const r = rankings?.get(id); return r ? ` · ★ ${r.ranking_producteur ?? 0} / terroir ${r.ranking_terroir ?? 0}` : ''; };
  const presentes = COULEURS.filter(([k]) => vins.some((v) => v.couleur === k));
  const choisiParam = vins.find((v) => v.id === sp.vin);
  const c = sp.c ?? choisiParam?.couleur ?? presentes[0]?.[0] ?? 'rouge';
  const affiches = vins.filter((v) => v.couleur === c);
  const choisi = choisiParam ?? affiches[0];
  const lien = (q: Record<string, string>) => `/admin/${resto}/carte?${new URLSearchParams({ c, ...(choisi ? { vin: choisi.id } : {}), ...q })}`;
  const sansEtiquette = vins.filter((v) => !v.etiquette_url).length;
  const enRecherche = vins.filter((v) => !v.etiquette_url && (v.etiquette_statut === 'demandee' || v.etiquette_statut === 'a_demander')).length;
  // Chaque étiquette trouvée coûte un crédit Wine Labs à Pat : la recherche manuelle est réservée au super-admin.
  const aChercher = vins.filter((v) => !v.etiquette_url && !['a_demander', 'demandee', 'introuvable'].includes(v.etiquette_statut ?? '')).length;
  const introuvables = vins.filter((v) => !v.etiquette_url && v.etiquette_statut === 'introuvable').length;
  const wineLabs = Boolean(u?.admin); // super-admin seulement : les crédits sont ceux de Pat
  const pourquoiPas = !identifiantsWineLabs() ? 'Wine Labs n’est pas configuré sur le serveur (WINE_LABS_API_KEY)'
    : !aChercher && (sansEtiquette === 0 ? 'toutes les étiquettes sont là'
    : enRecherche ? `${enRecherche} déjà en recherche${introuvables ? `, ${introuvables} introuvable(s)` : ''}` : `${introuvables} introuvable(s) chez Wine Labs : à photographier`);
  const profil = (choisi?.profil_degustation ?? {}) as Record<string, number | null>;
  const [pl, pk] = choisi ? producteur(choisi) : ['', ''];
  const sansLien = Boolean(choisi && !choisi.producteur_id && choisi.producteur_texte && !/^non /i.test(choisi.producteur_texte));
  // Suggestions : pour un nom pas encore relié, ou pour corriger un producteur proposé.
  const suggestions = choisi && (sansLien || choisi.statut_producteur === 'nouveau')
    ? (await suggestionsProducteurs(choisi.producteur_texte ?? choisi.producteur_nom)).filter((p) => p.id !== choisi.producteur_id && p.statut !== 'propose')
    : [];
  return (
    <>
      <Entete titre="Carte des vins" texte="Chaque vin est relié à la base de producteurs et de terroirs de Pat. Corrigez un prix, une rupture ou une étiquette : l’app est à jour tout de suite.">
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
              <Link key={k} href={`/admin/${resto}/carte?c=${k}`} aria-current={c === k ? 'true' : undefined}>{l} <span>{vins.filter((v) => v.couleur === k).length}</span></Link>
            ))}
          </nav>
          <div className="tableau">
            <table style={{ minWidth: 820 }}>
              <thead><tr><th>Vin</th><th>Millésime</th><th className="droite">Prix</th><th>Étiquette</th><th>Producteur</th><th /></tr></thead>
              <tbody>
                {affiches.map((v) => {
                  const [el, ek] = etiquette(v);
                  const [bl, bk] = producteur(v);
                  return (
                    <tr key={v.id} className={v.id === choisi?.id ? 'choisi' : ''}>
                      <td style={{ minWidth: 240 }}><div className="vin-cell"><Vignette url={v.etiquette_url} /><div><div className="nom">{v.libelle}{v.format !== '75 cl' ? ` · ${v.format}` : ''}</div><div className="petit">{v.id} · {v.producteur_nom ?? v.producteur_texte ?? '—'}</div></div></div></td>
                      <td>{v.millesime ?? '—'}</td>
                      <td className="droite" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{v.prix ? euros(v.prix) : v.prix_verre ? `${euros(v.prix_verre)} le verre` : '—'}</td>
                      <td><Etat type={ek}>{el}</Etat></td>
                      <td>{!v.disponible ? <Etat type="defaut">Indisponible</Etat> : <Etat type={bk}>{bl}</Etat>}{rankings && <div className="petit">{etoiles(v.id).slice(3)}</div>}</td>
                      <td className="droite"><Link className="lien-ligne" href={lien({ vin: v.id })} aria-label={`Modifier ${v.libelle}`}>Modifier</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {choisi && (
          <aside className="etroit">
            <form key={choisi.id} action={enregistrerVin.bind(null, resto, choisi.id)} className="carte-bo pile">
              <div className="pile" style={{ gap: 6 }}>
                <span className="surtitre">{choisi.id} · {choisi.section ?? choisi.couleur}</span>
                <h2>{choisi.libelle} {choisi.millesime ?? ''}</h2>
              </div>
              <Message ok={sp.ok === '1' ? 'Enregistré.' : sp.ok} erreur={sp.erreur} />
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 14, borderRadius: 14, border: '1px solid var(--ligne)', background: 'var(--fond)' }}>
                <Vignette url={choisi.etiquette_url} taille={104} />
                <div className="champ" style={{ flex: 1, minWidth: 0 }}>
                  <span className="libelle">Étiquette</span>
                  <Etat type={etiquette(choisi)[1]}>{etiquette(choisi)[0]}</Etat>
                  {u?.admin && choisi.etiquette_statut === 'echec' && choisi.etiquette_erreur && <span className="petit discret">Motif : {choisi.etiquette_erreur}</span>}
                  <label htmlFor="etiquette" className="aide" style={{ fontWeight: 400 }}>Remplacer par votre photo (JPG, PNG, WebP · 5 Mo max). Elle ne sera jamais écrasée par Wine Labs.
                    {choisi.producteur_id ? ' Elle rejoint la base de Pat : les autres cartes qui ont cette cuvée sans étiquette la reprendront.' : ' Indiquez le producteur pour qu’elle serve aussi à la base de Pat.'}</label>
                  <input id="etiquette" name="etiquette" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" style={{ minHeight: 0, padding: 8, width: '100%', maxWidth: '100%' }} />
                </div>
              </div>
              <fieldset className="pile" style={{ gap: 10, border: '1px solid var(--ligne)', borderRadius: 14, padding: 14, margin: 0 }}>
                <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>Producteur</legend>
                <div className="champ">
                  <label htmlFor="producteur_texte">Nom affiché</label>
                  <input id="producteur_texte" name="producteur_texte" placeholder="Nom du domaine ou de la maison" defaultValue={choisi.producteur_texte && /^non /i.test(choisi.producteur_texte) ? '' : choisi.producteur_texte ?? choisi.producteur_nom ?? ''} />
                </div>
                {choisi.producteur_id && (
                  <label className="case"><input type="radio" name="producteur_choix" value={choisi.producteur_id} defaultChecked />
                    <span><b>{choisi.producteur_nom}</b><small>{pl}{etoiles(choisi.id)}</small></span></label>
                )}
                {!choisi.producteur_id && sansLien && suggestions.length > 0 && (
                  <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Pat a trouvé des noms proches dans sa base : choisissez le bon producteur, ou proposez-le comme nouveau.</p>
                )}
                {suggestions.map((p) => (
                  <label key={p.id} className="case"><input type="radio" name="producteur_choix" value={p.id} />
                    <span>{p.nom}<small>{[p.region, p.pays].filter(Boolean).join(' · ')}{p.statut === 'propose' ? ' · nouveau producteur' : ' · déjà référencé'}</small></span></label>
                ))}
                {sansLien && (
                  <label className="case"><input type="radio" name="producteur_choix" value="nouveau" />
                    <span>Nouveau producteur : « {choisi.producteur_texte} »<small>Proposé à Pat pour sa base</small></span></label>
                )}
                <span className="aide" style={{ fontSize: 12.5, color: 'var(--discret)' }}>Saisissez le nom et enregistrez : Pat le cherche dans sa base. S’il ne le connaît pas, il lui est proposé comme nouveau producteur.</span>
              </fieldset>
              {pk === 'attention' && choisi.a_verifier && <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)', margin: 0 }}>À vérifier : {choisi.a_verifier}</p>}
              <div className="champs">
                <div className="champ"><label htmlFor="millesime">Millésime</label><input id="millesime" name="millesime" defaultValue={choisi.millesime ?? ''} /></div>
                <div className="champ"><label htmlFor="prix">Prix bouteille (€)</label><input id="prix" name="prix" inputMode="decimal" defaultValue={choisi.prix ?? ''} /></div>
                <div className="champ"><label htmlFor="prix_verre">Prix au verre (€)</label><input id="prix_verre" name="prix_verre" inputMode="decimal" defaultValue={choisi.prix_verre ?? ''} /></div>
              </div>
              <div className="champ"><label htmlFor="resume_court">Résumé court (vu par le client)</label><textarea id="resume_court" name="resume_court" rows={3} defaultValue={choisi.resume_court ?? ''} /></div>
              <div className="champ">
                <label htmlFor="presentation_carte_perso">Présentation (carte imprimée)</label>
                <textarea id="presentation_carte_perso" name="presentation_carte_perso" rows={5} defaultValue={choisi.presentation_carte_perso ?? ''} placeholder={choisi.presentation_carte ?? 'Trois phrases : le lieu ou le vigneron, le style du vin, ce avec quoi il brille à table.'} />
                <span className="aide">{choisi.presentation_carte ? 'Laissez vide pour garder le texte de Pat (en grisé) ; écrivez pour le remplacer.' : 'Trois phrases, 3 à 4 lignes sur la carte (230 à 380 caractères).'}</span>
              </div>
              {BARRES.some(([k]) => typeof profil[k] === 'number') && (
                <div className="pile" style={{ gap: 8 }}>
                  <span className="libelle" style={{ fontSize: 13, fontWeight: 700 }}>Profil de dégustation</span>
                  {BARRES.filter(([k]) => typeof profil[k] === 'number').map(([k, l]) => (
                    <div key={k} className="jauge"><span>{l}</span><span className="barres" role="img" aria-label={`${l} ${profil[k]} sur 5`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < (profil[k] ?? 0) ? 'plein' : ''} />)}</span></div>
                  ))}
                </div>
              )}
              <div>
                <label className="case"><input type="checkbox" name="disponible" defaultChecked={choisi.disponible} /><span>Disponible<small>Décochez en cas de rupture : Pat ne le propose plus</small></span></label>
                <label className="case"><input type="checkbox" name="coup_de_coeur" defaultChecked={choisi.coup_de_coeur} /><span>Coup de cœur de la maison</span></label>
              </div>
              <div className="ligne-actions">
                <button type="submit" className="btn petit">Enregistrer</button>
                <Link href={`/${resto}/vin/${choisi.id}`} target="_blank" className="btn sec petit">Voir la fiche client</Link>
              </div>
            </form>
            <div className="carte-bo pile" style={{ gap: 8 }}>
              <span className="discret" style={{ fontSize: 14 }}>Vin retiré définitivement de votre carte ? (Pour une rupture, décochez plutôt « Disponible ».)</span>
              <BoutonConfirmation action={supprimerVin.bind(null, resto, choisi.id)} libelle="Supprimer ce vin"
                question={`Supprimer « ${choisi.libelle} » de votre carte ? Ses accords seront supprimés aussi. Cette action est définitive.`} />
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
