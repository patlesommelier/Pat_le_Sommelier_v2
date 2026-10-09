// Fiche d'un vin dans le back-office : intitulé et champs qui le composent, producteur, prix, étiquette, présentation.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { PhotoEtiquette } from '@/components/admin/PhotoEtiquette';
import { IntituleVin } from '@/components/admin/IntituleVin';
import { BoutonConfirmation } from '@/components/admin/BoutonConfirmation';
import { Etat } from '@/components/admin/Ui';
import { enregistrerVin, supprimerVin } from '../../../actions';
import { utilisateurCourant, exigerAcces } from '@/lib/admin/auth';
import { getRankingsInternes, getVinsBO, suggestionsProducteurs } from '@/lib/admin/donnees';
import { appellationDeduite, nomDeduit } from '@/lib/admin/intitule';
import { etatEtiquette, etatProducteur } from '../etats';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blancs', rose: 'Rosés', rouge: 'Rouges', orange: 'Orange', doux: 'Doux' };
const BARRES = [['corps', 'Corps'], ['intensite', 'Intensité'], ['tanins', 'Tanins'], ['acidite', 'Acidité'], ['douceur', 'Douceur'], ['boise', 'Boisé']] as const;
const cadre = { gap: 12, border: '1px solid var(--ligne)', borderRadius: 14, padding: 16, margin: 0 } as const;
const legende = { fontSize: 13, fontWeight: 700, padding: '0 6px' } as const;

export default async function FicheVinBO({ params }: { params: Promise<{ resto: string; vin: string }> }) {
  const { resto, vin } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const id = decodeURIComponent(vin);
  const [vins, u] = await Promise.all([getVinsBO(resto), utilisateurCourant()]);
  const v = vins.find((x) => x.id === id);
  if (!v) notFound();
  // Rankings : chargés seulement pour Pat (administrateur), jamais pour un compte restaurant.
  const r = u?.admin ? (await getRankingsInternes(resto)).get(v.id) : null;
  const etoiles = r ? ` · ★ ${r.ranking_producteur ?? 0} / terroir ${r.ranking_terroir ?? 0}` : '';
  const [pl, pk] = etatProducteur(v);
  const [el, ek] = etatEtiquette(v);
  const sansLien = Boolean(!v.producteur_id && v.producteur_texte && !/^non /i.test(v.producteur_texte));
  // Suggestions : pour un nom pas encore relié, ou pour corriger un producteur proposé.
  const suggestions = sansLien || v.statut_producteur === 'nouveau'
    ? (await suggestionsProducteurs(v.producteur_texte ?? v.producteur_nom)).filter((p) => p.id !== v.producteur_id && p.statut !== 'propose')
    : [];
  const profil = (v.profil_degustation ?? {}) as Record<string, number | null>;
  const retour = `/admin/${resto}/carte?${new URLSearchParams({ c: v.couleur, vin: v.id })}`;
  const producteurAffiche = v.producteur_texte && /^non /i.test(v.producteur_texte) ? '' : v.producteur_texte ?? v.producteur_nom ?? '';

  return (
    <>
      <Link href={retour} className="lien-ligne" style={{ minHeight: 0, marginBottom: -8 }}>← Carte des vins · {COULEURS[v.couleur] ?? v.couleur}</Link>
      <header className="bo-entete">
        <div>
          <span className="surtitre">{v.id}{v.section ? ` · ${v.section}` : ''}</span>
          <h1>{v.libelle}{v.millesime ? ` ${v.millesime}` : ''}</h1>
        </div>
        <div className="ligne-actions">
          <Link href={`/${resto}/vin/${encodeURIComponent(v.id)}`} target="_blank" className="btn sec">Voir la fiche client</Link>
        </div>
      </header>

      <FormulaireAdmin key={v.id} action={enregistrerVin.bind(null, resto, v.id)} className="fiche-vin">
        <section className="pile" style={{ gap: 16, minWidth: 0 }}>
          <fieldset className="carte-bo pile" style={cadre}>
            <legend style={legende}>Le vin</legend>
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
                <span><b>{v.producteur_nom}</b><small>{pl}{etoiles}</small></span></label>
            )}
            {!v.producteur_id && sansLien && suggestions.length > 0 && (
              <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Pat a trouvé des noms proches dans sa base : choisissez le bon producteur, ou proposez-le comme nouveau.</p>
            )}
            {suggestions.map((p) => (
              <label key={p.id} className="case"><input type="radio" name="producteur_choix" value={p.id} />
                <span>{p.nom}<small>{[p.region, p.pays].filter(Boolean).join(' · ')}{p.statut === 'propose' ? ' · nouveau producteur' : ' · déjà référencé'}</small></span></label>
            ))}
            {sansLien && (
              <label className="case"><input type="radio" name="producteur_choix" value="nouveau" />
                <span>Nouveau producteur : « {v.producteur_texte} »<small>Proposé à Pat pour sa base</small></span></label>
            )}
            <span className="aide" style={{ fontSize: 12.5, color: 'var(--discret)' }}>Saisissez le nom et enregistrez : Pat le cherche dans sa base. S’il ne le connaît pas, il lui est proposé comme nouveau producteur.</span>
            {pk === 'attention' && v.a_verifier && <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)', margin: 0 }}>À vérifier : {v.a_verifier}</p>}
          </fieldset>

          <fieldset className="carte-bo pile" style={cadre}>
            <legend style={legende}>Millésime et prix</legend>
            <div className="champs">
              <div className="champ"><label htmlFor="millesime">Millésime</label><input id="millesime" name="millesime" defaultValue={v.millesime ?? ''} /></div>
              <div className="champ"><label htmlFor="prix">Prix bouteille (€)</label><input id="prix" name="prix" inputMode="decimal" defaultValue={v.prix ?? ''} /></div>
              <div className="champ"><label htmlFor="prix_verre">Prix au verre (€)</label><input id="prix_verre" name="prix_verre" inputMode="decimal" defaultValue={v.prix_verre ?? ''} /></div>
            </div>
            <div>
              <label className="case"><input type="checkbox" name="disponible" defaultChecked={v.disponible} /><span>Disponible<small>Décochez en cas de rupture : Pat ne le propose plus</small></span></label>
              <label className="case"><input type="checkbox" name="coup_de_coeur" defaultChecked={v.coup_de_coeur} /><span>Coup de cœur de la maison</span></label>
            </div>
          </fieldset>

          <div className="champ carte-bo">
            <label htmlFor="presentation_carte_perso">Présentation (app et carte imprimée)</label>
            <textarea id="presentation_carte_perso" name="presentation_carte_perso" rows={5} defaultValue={v.presentation_carte_perso ?? ''} placeholder={v.presentation_carte ?? 'Trois phrases : le lieu ou le vigneron, le style du vin, ce avec quoi il brille à table.'} />
            <span className="aide">{v.presentation_carte ? 'Laissez vide pour garder le texte de Pat (en grisé) ; écrivez pour le remplacer.' : 'Trois phrases, 3 à 4 lignes sur la carte (230 à 380 caractères).'}</span>
          </div>

          <div className="ligne-actions">
            <button type="submit" className="btn">Enregistrer</button>
            <Link href={retour} className="btn sec">Retour à la carte</Link>
          </div>
        </section>

        <aside className="pile" style={{ gap: 16, minWidth: 0 }}>
          {/* Clé = adresse de l'étiquette : après l'enregistrement, l'aperçu laisse place à la photo enregistrée. */}
          <PhotoEtiquette key={v.etiquette_url ?? 'sans'} url={v.etiquette_url}>
            <span className="libelle">Étiquette</span>
            <Etat type={ek}>{el}</Etat>
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

      <div className="carte-bo pile" style={{ gap: 8, maxWidth: 560 }}>
        <span className="discret" style={{ fontSize: 14 }}>Vin retiré définitivement de votre carte ? (Pour une rupture, décochez plutôt « Disponible ».)</span>
        <BoutonConfirmation action={supprimerVin.bind(null, resto, v.id)} libelle="Supprimer ce vin"
          question={`Supprimer « ${v.libelle} » de votre carte ? Ses accords seront supprimés aussi. Cette action est définitive.`} />
      </div>
    </>
  );
}
