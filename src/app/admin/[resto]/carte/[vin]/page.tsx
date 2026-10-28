// Fiche d'un vin dans le back-office : intitulé et champs qui le composent, producteur, prix, étiquette, présentation.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { PhotoEtiquette } from '@/components/admin/PhotoEtiquette';
import { IntituleVin } from '@/components/admin/IntituleVin';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { Etat } from '@/components/admin/Ui';
import { enregistrerVin, supprimerVin } from '../../../actions';
import { utilisateurCourant, exigerAcces } from '@/lib/admin/auth';
import { getRankingsInternes, getVinsBO, ligneNotesPat, suggestionsProducteurs } from '@/lib/admin/donnees';
import { appellationDeduite, nomDeduit, titreCarte } from '@/lib/admin/intitule';
import { autresContenances, etatEtiquette, etatProducteur } from '../etats';
import { CONTENANCES, contenanceDuFormat, ordonner } from '@/lib/contenances';
import { SelectFournisseur } from '@/components/admin/SelectFournisseur';
import { getFournisseurs } from '@/lib/admin/stocks';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blancs', rose: 'Rosés', rouge: 'Rouges', orange: 'Orange', doux: 'Doux', sans_alcool: 'Sans alcool' };
const BARRES = [['corps', 'Corps'], ['intensite', 'Intensité'], ['tanins', 'Tanins'], ['acidite', 'Acidité'], ['douceur', 'Douceur'], ['boise', 'Boisé']] as const;
const cadre = { gap: 12, border: '1px solid var(--ligne)', borderRadius: 14, padding: 16, margin: 0 } as const;
const legende = { fontSize: 13, fontWeight: 700, padding: '0 6px' } as const;

export default async function FicheVinBO({ params, searchParams }: { params: Promise<{ resto: string; vin: string }>; searchParams: Promise<{ retour?: string }> }) {
  const { resto, vin } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const id = decodeURIComponent(vin);
  const [vins, u, fournisseurs] = await Promise.all([getVinsBO(resto), utilisateurCourant(), getFournisseurs(resto)]);
  const v = vins.find((x) => x.id === id);
  if (!v) notFound();
  // Rankings : chargés seulement pour Pat (administrateur), jamais pour un compte restaurant.
  const r = u?.admin ? (await getRankingsInternes(resto)).get(v.id) : null;
  const etoiles = r ? ` · ${ligneNotesPat(r)}` : '';
  const [pl, pk] = etatProducteur(v);
  const [el, ek] = etatEtiquette(v, true);
  const sansLien = Boolean(!v.producteur_id && v.producteur_texte && !/^non /i.test(v.producteur_texte));
  // Suggestions : pour un nom pas encore relié, ou pour corriger un producteur proposé.
  const suggestions = sansLien || v.statut_producteur === 'nouveau'
    ? (await suggestionsProducteurs(v.producteur_texte ?? v.producteur_nom)).filter((p) => p.id !== v.producteur_id && p.statut !== 'propose')
    : [];
  const autres = autresContenances(vins, v);
  const cochees = ordonner(v.contenances);
  // Magnum : proposé seulement quand la carte en a un (les cases demandées sont bouteille, ½, ¼ et verre).
  const cases = CONTENANCES.filter((c) => c.code !== 'magnum' || cochees.includes('magnum') || contenanceDuFormat(v.format) === 'magnum');
  // Prix de chaque contenance : la ligne du vin dans cette contenance (le verre : prix au verre).
  const groupe = [v, ...autres];
  const prixDe = (code: string) => code === 'verre'
    ? groupe.find((x) => x.prix_verre != null)?.prix_verre ?? null
    : groupe.find((x) => contenanceDuFormat(x.format) === code)?.prix ?? null;
  const profil = (v.profil_degustation ?? {}) as Record<string, number | null>;
  // Ouvert depuis « Vins de la base » (super-admin) : on y revient après l'enregistrement, pas sur la carte du restaurant.
  const depuisBase = (await searchParams).retour;
  const versBase = depuisBase?.startsWith('/admin/super/vins') ? depuisBase : null;
  const retour = versBase ?? `/admin/${resto}/carte?${new URLSearchParams({ c: v.couleur, vin: v.id })}`;
  const affiche = titreCarte({ ...v, producteur: v.producteur_texte && !/^non /i.test(v.producteur_texte) ? v.producteur_texte : v.producteur_nom });
  const producteurAffiche = v.producteur_texte && /^non /i.test(v.producteur_texte) ? '' : v.producteur_texte ?? v.producteur_nom ?? '';

  return (
    <>
      <Link href={retour} className="lien-ligne" style={{ minHeight: 0, marginBottom: -8 }}>{versBase ? '← Vins de la base' : <>← Carte des vins · {COULEURS[v.couleur] ?? v.couleur}</>}</Link>
      <header className="bo-entete">
        <div>
          {/* Code interne du vin : super-admin seulement. */}
          <span className="surtitre">{[u?.admin ? v.id : null, v.section].filter(Boolean).join(' · ')}</span>
          {/* Comme dans l'app : nom du vin et millésime, puis producteur, appellation et cépages. */}
          <h1>{affiche.titre}</h1>
          {affiche.sousTitre && <p style={{ margin: '4px 0 0', color: 'var(--discret)' }}>{affiche.sousTitre}</p>}
        </div>
        <div className="ligne-actions">
          <Link href={`/${resto}/vin/${encodeURIComponent(v.id)}`} target="_blank" className="btn sec">Voir la fiche client</Link>
        </div>
      </header>

      <FormulaireAdmin key={v.id} action={enregistrerVin.bind(null, resto, v.id)} className="fiche-vin">
        {versBase && <input type="hidden" name="retour" value={versBase} />}
        <section className="pile" style={{ gap: 16, minWidth: 0 }}>
          <fieldset className="carte-bo pile" style={cadre}>
            <legend style={legende}>Le vin</legend>
            <div className="champ" style={{ maxWidth: 260 }}><label htmlFor="couleur">Catégorie</label>
              <select id="couleur" name="couleur" defaultValue={v.couleur}>{Object.entries(COULEURS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <IntituleVin initial={v.libelle} />
            <div className="champs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
              <div className="champ"><label htmlFor="appellation_texte">Appellation</label>
                <input id="appellation_texte" name="appellation_texte" placeholder="Ex. Chablis" defaultValue={v.appellation_texte ?? appellationDeduite(v.vin_texte, v.appellation_nom)} /></div>
              <div className="champ"><label htmlFor="nom_vin">Nom du vin</label>
                <input id="nom_vin" name="nom_vin" placeholder="Ex. Saint-Pierre (laisser vide s’il n’en a pas)" defaultValue={v.nom_vin ?? nomDeduit(v.vin_texte)} /></div>
              <div className="champ"><label htmlFor="cepages">Cépage(s)</label>
                <input id="cepages" name="cepages" placeholder="Ex. Chardonnay" defaultValue={v.cepages ?? ''} /></div>
            </div>
          </fieldset>

          <fieldset className="carte-bo pile" style={cadre}>
            <legend style={legende}>Producteur</legend>
            <div className="champ">
              <label htmlFor="producteur_texte">Nom affiché</label>
              <input id="producteur_texte" name="producteur_texte" placeholder="Nom du domaine ou de la maison" defaultValue={producteurAffiche} />
            </div>
            {v.producteur_id && (
              <label className="case"><input type="radio" name="producteur_choix" value={v.producteur_id} defaultChecked />
                <span><b>{v.producteur_nom}</b>{u?.admin && <small>{pl}{etoiles}</small>}</span></label>
            )}
            {/* Super-admin seulement : la fiche complète du producteur dans la base de Pat. */}
            {u?.admin && v.producteur_id && (
              <Link href={`/admin/super/producteurs/${encodeURIComponent(v.producteur_id)}`} target="_blank" className="petit">Fiche complète du producteur (super-admin) →</Link>
            )}
            {/* Super-admin seulement : notes de la base de Pat utilisées pour ce vin (jamais montrées au restaurant). */}
            {r && (
              <div className="petit" style={{ border: '1px dashed var(--ligne, #AFB0AE)', borderRadius: 8, padding: '8px 10px' }}>
                <b>Notes de Pat (super-admin)</b> : producteur {r.note_producteur ?? '—'}{r.note_vin !== null ? ` · vin ${r.note_vin} (remplace celle du producteur)` : ''} · terroir {r.ranking_terroir ?? '—'}
                {' '}→ compte pour <b>{r.ranking_producteur ?? 0}</b> dans le score.
                {r.cuvee_id
                  ? <> <Link href={`/admin/super/vins/${encodeURIComponent(r.cuvee_id)}`} target="_blank">Note du vin →</Link></>
                  : ' Vin pas encore dans la base : la note du producteur s’applique.'}
              </div>
            )}
            {!v.producteur_id && sansLien && suggestions.length > 0 && (
              <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Pat a trouvé des noms proches dans sa base : choisissez le bon producteur, ou proposez-le comme nouveau.</p>
            )}
            {suggestions.map((p) => (
              <label key={p.id} className="case"><input type="radio" name="producteur_choix" value={p.id} />
                <span>{p.nom}<small>{[p.region, p.pays].filter(Boolean).join(' · ')}{u?.admin ? (p.statut === 'propose' ? ' · nouveau producteur' : ' · déjà référencé') : ''}</small></span></label>
            ))}
            {sansLien && (
              <label className="case"><input type="radio" name="producteur_choix" value="nouveau" />
                <span>Nouveau producteur : « {v.producteur_texte} »<small>Proposé à Pat pour sa base</small></span></label>
            )}
            <span className="aide" style={{ fontSize: 12.5, color: 'var(--discret)' }}>Saisissez le nom et enregistrez : Pat le cherche dans sa base. S’il ne le connaît pas, il lui est proposé comme nouveau producteur.</span>
            {pk === 'attention' && v.a_verifier && <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)', margin: 0 }}>À vérifier : {v.a_verifier}</p>}
          </fieldset>

          <fieldset className="carte-bo pile" style={cadre}>
            <legend style={legende}>Contenances, millésime et prix</legend>
            <input type="hidden" name="contenances_envoyees" value="1" />
            <div className="pile" style={{ gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Contenances disponibles et prix</span>
              {cases.map((c) => (
                <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label className="case" style={{ margin: 0, width: 150 }}><input type="checkbox" name="contenances" value={c.code} defaultChecked={cochees.includes(c.code)} /><span>{c.libelle}</span></label>
                  <div className="champ" style={{ margin: 0, width: 120 }}>
                    <input name={`prix_${c.code}`} inputMode="decimal" aria-label={`Prix ${c.libelle.toLowerCase()} (€)`} placeholder="Prix"
                      defaultValue={prixDe(c.code) ?? ''} />
                  </div>
                  <span className="discret">€{c.code === 'verre' ? ' le verre' : ''}</span>
                </div>
              ))}
              <span className="aide" style={{ fontSize: 12.5, color: 'var(--discret)' }}>Cochez les contenances servies et indiquez leur prix : chacune apparaît sur la carte de l’app.</span>
            </div>
            <div className="champ" style={{ maxWidth: 240 }}><label htmlFor="millesime">Millésime</label><input id="millesime" name="millesime" defaultValue={v.millesime ?? ''} /></div>
            <div>
              <label className="case"><input type="checkbox" name="disponible" defaultChecked={groupe.some((x) => x.disponible)} /><span>Disponible<small>Décochez en cas de rupture : Pat ne le propose plus</small></span></label>
              <label className="case"><input type="checkbox" name="coup_de_coeur" defaultChecked={v.coup_de_coeur} /><span>Coup de cœur de la maison<small>Petit cœur ♥ dans l’app ; si la catégorie « Coups de cœur » est choisie dans Apparence, il n’apparaît que là.</small></span></label>
              <input type="hidden" name="bio_nature_envoyes" value="1" />
              <label className="case"><input type="checkbox" name="bio" defaultChecked={groupe.some((x) => x.bio)} /><span>Vin bio<small>Petite feuille verte dans l’app et sur la carte imprimée.</small></span></label>
              <label className="case"><input type="checkbox" name="nature" defaultChecked={groupe.some((x) => x.nature)} /><span>Vin nature<small>Petite grappe verte dans l’app et sur la carte imprimée.</small></span></label>
            </div>
          </fieldset>

          {/* Fournisseur du vin (gestion des stocks) : on peut en ajouter un en le nommant. */}
          <div className="champ carte-bo">
            <label>Fournisseur</label>
            <input type="hidden" name="fournisseur_envoye" value="1" />
            <SelectFournisseur nom="fournisseur" fournisseurs={fournisseurs} valeur={v.fournisseur_id} />
            <span className="aide">Le stock de ce vin et ses commandes se gèrent dans <Link href={`/admin/${resto}/stocks`}>Stocks</Link> : {v.stock} bouteille{v.stock > 1 ? 's' : ''} en stock{v.en_commande ? `, ${v.en_commande} en commande` : ''}.</span>
          </div>

          <div className="champ carte-bo">
            <label htmlFor="presentation_carte_perso">Présentation (app et carte imprimée)</label>
            <textarea id="presentation_carte_perso" name="presentation_carte_perso" rows={5} defaultValue={v.presentation_carte_perso ?? ''} placeholder={v.presentation_carte ?? 'Trois phrases : le lieu ou le vigneron, le style du vin, ce avec quoi il brille à table.'} />
            <span className="aide">{v.presentation_carte ? 'Laissez vide pour garder le texte de Pat (en grisé) ; écrivez pour le remplacer.' : 'Trois phrases, 3 à 4 lignes sur la carte (230 à 380 caractères).'}</span>
          </div>

          <div className="ligne-actions">
            <button type="submit" className="btn">Enregistrer</button>
            <BoutonSupprimer action={supprimerVin.bind(null, resto, v.id)} libelle="Supprimer ce vin"
              question={`Supprimer « ${v.libelle} » de votre carte ? Ses accords seront supprimés aussi. Cette action est définitive.`} />
          </div>
        </section>

        <aside className="pile" style={{ gap: 16, minWidth: 0 }}>
          {/* Clé = adresse de l'étiquette : après l'enregistrement, l'aperçu laisse place à la photo enregistrée. */}
          <PhotoEtiquette key={v.etiquette_url ?? 'sans'} url={v.etiquette_url}>
            <span className="libelle">Étiquette</span>
            {(u?.admin || el !== 'Base de Pat') && <Etat type={ek}>{el}</Etat>}
            {u?.admin && v.etiquette_statut === 'echec' && v.etiquette_erreur && <span className="petit discret">Motif : {v.etiquette_erreur}</span>}
          </PhotoEtiquette>
          {BARRES.some(([k]) => typeof profil[k] === 'number') && (
            <div className="carte-bo pile" style={{ gap: 8 }}>
              <span className="libelle" style={{ fontSize: 13, fontWeight: 700 }}>Profil de dégustation</span>
              {BARRES.filter(([k]) => typeof profil[k] === 'number').map(([k, l]) => (
                <div key={k} className="jauge"><span>{l}</span><span className="barres" role="img" aria-label={`${l} ${profil[k]} sur 5`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < (profil[k] ?? 0) ? 'plein' : ''} />)}</span></div>
              ))}
            </div>
          )}
        </aside>
      </FormulaireAdmin>
    </>
  );
}
