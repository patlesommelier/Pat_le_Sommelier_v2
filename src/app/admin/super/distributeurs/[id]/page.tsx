// Super-admin — fiche d'un distributeur : coordonnées et marge, tarif (PDF lu par Claude), vins au prix QV et prix proposé aux restaurants.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ajouterVinDistributeur, deposerTarif, enregistrerApi, enregistrerDistributeur, enregistrerVins, relireTarif, supprimerDistributeur, synchroniserApi } from '../../distributeurs-actions';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { getDistributeur, getVinsDistributeur } from '@/lib/distributeurs/donnees';
import { prixPropose, sansAccents } from '@/lib/distributeurs/tarif';
import { euros } from '@/lib/bon-commande';

export const dynamic = 'force-dynamic';

const date = (d: string) => new Date(d).toLocaleString('fr-BE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Brussels' });
const virgule = (n: number | null) => (n == null ? '' : n.toFixed(2).replace('.', ','));

export default async function FicheDistributeur({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string; q?: string; tous?: string }> }) {
  await exigerAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getDistributeur(id);
  if (!d) notFound();
  const [tous, producteurs] = await Promise.all([getVinsDistributeur(id),
    requete<{ nom: string }>(`select distinct nom from producteur where statut <> 'retire' order by nom`)]);
  const q = sansAccents(sp.q?.trim() ?? '');
  const vins = tous.filter((v) => (sp.tous || v.actif) && (!q || sansAccents(`${v.producteur_texte ?? ''} ${v.libelle} ${v.millesime ?? ''} ${v.producteur_nom ?? ''} ${v.section ?? ''}`).includes(q)));
  const actifs = tous.filter((v) => v.actif);
  const rattaches = actifs.filter((v) => v.producteur_id).length;
  // Lecture interrompue (serveur redémarré) : au-delà de 30 minutes, on propose de la relancer.
  const enCours = d.lecture_statut === 'en_cours' && d.lecture_le && Date.now() - new Date(d.lecture_le).getTime() < 30 * 60_000;
  const marge = Number(d.marge);

  return (
    <>
      <Entete titre={d.nom} texte="Les vins du distributeur au prix d’achat de Quid Vinum (HTVA). Les restaurants voient seulement le prix proposé : prix QV + marge, ou le prix imposé pour ce vin.">
        <Link href="/admin/super/distributeurs" className="btn sec">← Distributeurs</Link>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      {enCours && <ActualisationAuto secondes={8} />}

      <div className="rangee">
        <div className="large" style={{ gap: 16 }}>
          <details className="carte-bo" open={!tous.length}>
            <summary style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.logo_url && <img src={d.logo_url} alt="" className="logo-distributeur" />}
              <b style={{ fontSize: 17 }}>Coordonnées, logo et marge</b> <span className="discret">· marge {String(marge).replace('.', ',')} %{d.remise_qv != null ? ` · remise QV ${String(d.remise_qv).replace('.', ',')} %` : ''}{d.actif ? '' : ' · masqué aux restaurants'}</span></summary>
            <div className="grille-coordonnees">
            <FormulaireAdmin action={enregistrerDistributeur.bind(null, id)} className="pile" style={{ marginTop: 14 }}>
            <div className="champ"><label htmlFor="nom">Nom</label><input id="nom" name="nom" defaultValue={d.nom} required /></div>
            <div className="rangee" style={{ gap: 12 }}>
              <div className="champ" style={{ flex: 1 }}><label htmlFor="marge">Marge QV (%)</label><input id="marge" name="marge" inputMode="decimal" defaultValue={String(marge).replace('.', ',')} required /><span className="aide">ajoutée au prix QV</span></div>
              <div className="champ" style={{ flex: 1 }}><label htmlFor="remise_qv">Remise QV (%)</label><input id="remise_qv" name="remise_qv" inputMode="decimal" defaultValue={d.remise_qv != null ? String(d.remise_qv).replace('.', ',') : ''} /><span className="aide">pour mémoire</span></div>
            </div>
            <label className="petit" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="actif" defaultChecked={d.actif} /> Proposé aux restaurants</label>
            <div className="champ"><label htmlFor="logo">Logo</label><input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
              {d.logo_url ? <label className="aide" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="retirer_logo" /> Retirer le logo actuel</label> : <span className="aide">PNG, JPG, WebP ou SVG</span>}</div>
            <div className="champ"><label htmlFor="source">Source du tarif</label>
              <select id="source" name="source" defaultValue={d.source}><option value="fichier">Fichier déposé (PDF, Excel ou CSV)</option><option value="api">API du distributeur</option></select></div>
            <div className="champ"><label htmlFor="modele_lecture">Lecture par Claude</label>
              <select id="modele_lecture" name="modele_lecture" defaultValue={d.modele_lecture}>
                <option value="sonnet">Sonnet (conseillé)</option><option value="haiku">Haiku (le moins cher)</option><option value="opus">Opus (le plus précis, le plus cher)</option>
              </select><span className="aide">pour les PDF, et les tableaux dont les colonnes ne sont pas reconnues</span></div>
            <div className="champ"><label htmlFor="contact">Contact</label><input id="contact" name="contact" defaultValue={d.contact ?? ''} /></div>
            <div className="champ"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={d.email ?? ''} /></div>
            <div className="champ"><label htmlFor="telephone">Téléphone</label><input id="telephone" name="telephone" defaultValue={d.telephone ?? ''} /></div>
            <div className="champ"><label htmlFor="site">Site</label><input id="site" name="site" defaultValue={d.site ?? ''} /></div>
            <div className="champ"><label htmlFor="adresse">Adresse</label><textarea id="adresse" name="adresse" rows={2} defaultValue={d.adresse ?? ''} /></div>
            <div className="champ"><label htmlFor="tva">TVA</label><input id="tva" name="tva" defaultValue={d.tva ?? ''} /></div>
            <div className="champ"><label htmlFor="notes">Notes (internes)</label><textarea id="notes" name="notes" rows={3} defaultValue={d.notes ?? ''} /></div>
            <div className="ligne-actions"><button className="btn">Enregistrer</button>
              <BoutonSupprimer action={supprimerDistributeur.bind(null, id)} libelle="Supprimer ce distributeur" enCoursLibelle="Suppression…" className="btn fantome petit"
            question={`Supprimer « ${d.nom} », ses tarifs et ses vins ? Les restaurants qui l’avaient choisi le gardent comme simple fournisseur.`} /></div>
          </FormulaireAdmin>
            </div>
          </details>
          <section className="carte-bo pile">
            <div><h2>Tarif</h2><p className="sous">{d.source === 'api'
              ? 'Le tarif est lu depuis l’API du distributeur. Un tableau dont les colonnes sont reconnues est lu sans IA ; sinon, par Claude.'
              : 'Déposez le tarif : un PDF (son texte est lu par Claude, le modèle choisi dans les coordonnées), ou un fichier Excel ou CSV (ses colonnes sont reconnues sans IA quand c’est possible).'}
              {' '}Un vin déjà connu garde son prix imposé et son producteur choisi à la main ; un vin absent du nouveau tarif n’est plus proposé.</p></div>
            {d.lecture_statut && (
              <p style={{ margin: 0 }}>
                {enCours ? <Etat type="propose">Lecture en cours…</Etat> : d.lecture_statut === 'terminee' ? <Etat type="ok">Lu</Etat> : d.lecture_statut === 'echec' ? <Etat type="attention">Échec</Etat> : <Etat type="attention">Interrompue</Etat>}
                {' '}<span className="petit">{d.lecture_message}</span>{d.lecture_le && <span className="discret petit"> · {date(d.lecture_le)}</span>}
              </p>
            )}
            {(() => {
              const fichier = (
                <div className="pile" style={{ gap: 10 }}>
                  {d.tarif_nom && <p style={{ margin: 0 }}>Dernier fichier : <a href={`/admin/super/distributeurs/${id}/tarif`} target="_blank" rel="noopener"><b>{d.tarif_nom}</b></a> <span className="discret">· déposé le {date(d.tarif_le!)}</span></p>}
                  <form action={deposerTarif.bind(null, id)} className="ligne-actions" style={{ alignItems: 'center' }}>
                    <input type="file" name="tarif" accept="application/pdf,.xlsx,.csv,text/csv" required aria-label="Tarif du distributeur (PDF, Excel ou CSV)" />
                    <button className="btn" disabled={Boolean(enCours)}>Déposer et lire le tarif</button>
                  </form>
                  {d.tarif_nom && !enCours && <FormulaireAdmin action={relireTarif.bind(null, id)}><button className="btn fantome petit" style={{ paddingLeft: 0 }}>Relire le dernier fichier</button></FormulaireAdmin>}
                </div>
              );
              const api = (
                <div className="pile" style={{ gap: 10 }}>
                  <FormulaireAdmin action={enregistrerApi.bind(null, id)} className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12, alignItems: 'end' }}>
                    <div className="champ" style={{ gridColumn: '1 / -1' }}><label htmlFor="api_url">Adresse de l’API (tarif)</label><input id="api_url" name="api_url" type="url" defaultValue={d.api_url ?? ''} placeholder="https://…" /></div>
                    <div className="champ"><label htmlFor="api_entete">En-tête d’accès</label><input id="api_entete" name="api_entete" defaultValue={d.api_entete ?? ''} placeholder="Authorization, X-API-Key…" /></div>
                    <div className="champ"><label htmlFor="api_cle">Clé d’accès</label><input id="api_cle" name="api_cle" type="password" autoComplete="off" placeholder={d.api_cle_enregistree ? 'Clé enregistrée (inchangée si vide)' : 'Donnée par le distributeur'} />
                      {d.api_cle_enregistree && <label className="aide" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="effacer_cle" /> Effacer la clé</label>}</div>
                    <span><button className="btn sec">Enregistrer l’API</button></span>
                  </FormulaireAdmin>
                  {d.api_url && (
                    <FormulaireAdmin action={synchroniserApi.bind(null, id)} className="ligne-actions" style={{ alignItems: 'center' }}>
                      <button className="btn" disabled={Boolean(enCours)}>Lire le tarif depuis l’API</button>
                      {d.api_synchro_le && <span className="discret petit">dernière lecture le {date(d.api_synchro_le)}</span>}
                    </FormulaireAdmin>
                  )}
                </div>
              );
              return d.source === 'api'
                ? <>{api}<details><summary style={{ cursor: 'pointer' }} className="petit">Ou déposer un fichier</summary><div style={{ marginTop: 10 }}>{fichier}</div></details></>
                : <>{fichier}<details><summary style={{ cursor: 'pointer' }} className="petit">Brancher l’API du distributeur</summary><div style={{ marginTop: 10 }}>{api}</div></details></>;
            })()}
          </section>

          <section className="pile">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Vins <span className="discret" style={{ fontWeight: 500 }}>{actifs.length} proposés · {rattaches} rattachés à la base de Pat</span></h2>
              <form className="ligne-actions" style={{ alignItems: 'center' }}>
                <input name="q" defaultValue={sp.q ?? ''} type="search" className="recherche" placeholder="Chercher un vin, un domaine…" aria-label="Chercher" />
                <label className="petit" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="tous" value="1" defaultChecked={Boolean(sp.tous)} /> Avec les vins retirés</label>
                <button className="btn sec petit">Filtrer</button>
              </form>
            </div>
            <datalist id="producteurs-base">{producteurs.map((p) => <option key={p.nom} value={p.nom} />)}</datalist>
            <FormulaireAdmin action={enregistrerVins.bind(null, id)} className="pile" style={{ gap: 12 }}>
              <div className="carte-bo" style={{ padding: 0 }}>
                <div className="tableau">
                  <table style={{ minWidth: 980 }}>
                    <thead><tr><th>Vin</th><th>Producteur de la base de Pat</th><th className="droite">Prix QV</th><th className="droite">Prix proposé</th><th className="droite">Prix imposé</th><th className="droite">Proposé</th></tr></thead>
                    <tbody>
                      {!vins.length && <tr><td colSpan={6} className="discret">{tous.length ? 'Aucun vin ne correspond.' : 'Aucun vin : déposez le tarif ci-dessus, ou ajoutez les vins à la main.'}</td></tr>}
                      {vins.map((v) => (
                        <tr key={v.id} style={v.actif ? undefined : { opacity: 0.55 }}>
                          <td>
                            <div className="nom"><b>{v.libelle}</b>{v.millesime ? ` ${v.millesime}` : ''}{v.contenance ? <span className="discret"> · {v.contenance}</span> : null}</div>
                            <div className="petit">{v.producteur_texte ?? <span className="discret">producteur non indiqué</span>}{v.certification ? ` · ${v.certification}` : ''}{v.section ? <span className="discret"> · {v.section}</span> : null}
                              {v.epuise && <> · <b style={{ color: 'var(--rouge, #FF0D05)' }}>Épuisé</b></>}{v.maximum != null && <> · Max. {v.maximum}</>}</div>
                          </td>
                          <td><input name={`prod_${v.id}`} list="producteurs-base" defaultValue={v.producteur_nom ?? ''} placeholder="Non rattaché" aria-label={`Producteur de la base : ${v.libelle}`} className="champ-liste" />
                            {v.producteur_id && !v.producteur_manuel && <span className="discret petit">trouvé par Pat</span>}</td>
                          <td className="droite"><span className="champ-prix"><input type="text" inputMode="decimal" name={`prix_${v.id}`} defaultValue={virgule(v.prix_qv)} aria-label={`Prix QV : ${v.libelle}`} /> €</span></td>
                          <td className="droite" style={{ whiteSpace: 'nowrap' }}>{(() => { const p = prixPropose(v.prix_qv, marge, v.prix_restaurant); return p == null ? '—' : euros(p); })()}</td>
                          <td className="droite"><span className="champ-prix"><input type="text" inputMode="decimal" name={`impose_${v.id}`} defaultValue={virgule(v.prix_restaurant)} placeholder="—" aria-label={`Prix imposé aux restaurants : ${v.libelle}`} /> €</span></td>
                          <td className="droite"><input type="checkbox" name={`actif_${v.id}`} defaultChecked={v.actif} aria-label={`Proposé aux restaurants : ${v.libelle}`} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {vins.length > 0 && <span><button className="btn">Enregistrer</button></span>}
            </FormulaireAdmin>
            <details className="carte-bo">
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ajouter un vin à la main</summary>
              <FormulaireAdmin action={ajouterVinDistributeur.bind(null, id)} className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, marginTop: 12, alignItems: 'end' }}>
                <div className="champ"><label htmlFor="n-prod">Producteur</label><input id="n-prod" name="producteur" /></div>
                <div className="champ"><label htmlFor="n-lib">Vin (appellation, cuvée)</label><input id="n-lib" name="libelle" required /></div>
                <div className="champ"><label htmlFor="n-mil">Millésime</label><input id="n-mil" name="millesime" inputMode="numeric" maxLength={4} /></div>
                <div className="champ"><label htmlFor="n-cl">Contenance</label><input id="n-cl" name="contenance" placeholder="75 cl" /></div>
                <div className="champ"><label htmlFor="n-coul">Couleur</label><select id="n-coul" name="couleur" defaultValue=""><option value="">—</option>{['bulles', 'blanc', 'rose', 'orange', 'rouge', 'doux'].map((c) => <option key={c} value={c}>{c === 'rose' ? 'rosé' : c}</option>)}</select></div>
                <div className="champ"><label htmlFor="n-prix">Prix QV HTVA</label><input id="n-prix" name="prix" inputMode="decimal" /></div>
                <span><button className="btn sec">Ajouter</button></span>
              </FormulaireAdmin>
            </details>
          </section>
        </div>

      </div>
    </>
  );
}
