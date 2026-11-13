// Super-admin — fiche d’un distributeur : coordonnées et remise, tarif lu par Claude, vins (prix publics, prix QV, prix restaurant), remises des restaurants.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ajouterProducteur, ajouterProducteursSansProposition, ajouterVinDistributeur, ajouterVinsBase, associerProducteur, collerTarif, enregistrerRemises, completerVins, deposerTarif, recadrerPhotos, retirerLienProducteur, enregistrerApi, enregistrerDistributeur, enregistrerVins, relireTarif, supprimerDistributeur, synchroniserApi } from '../../distributeurs-actions';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { CollageTarif } from '@/components/admin/CollageTarif';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Etat, Message, Vignette } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { getCuveesDistributeur, getDistributeur, restaurantsDistributeur, getProducteursDistributeur, getVinsDistributeur, photosARecadrer, vinsACompleter } from '@/lib/distributeurs/donnees';
import { domaineDuSite } from '@/lib/distributeurs/completer';
import { sansAccents } from '@/lib/distributeurs/tarif';
import { euros } from '@/lib/bon-commande';
import { prixRestaurant } from '@/lib/distributeurs/prix-restaurant';

export const dynamic = 'force-dynamic';

const date = (d: string) => new Date(d).toLocaleString('fr-BE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Brussels' });
/** Ranking de Pat (0 à 5), réservé au super-admin. */
const ranking = (n: number | null) => (n == null ? 'sans ranking' : `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`);
const virgule = (n: number | null) => (n == null ? '' : n.toFixed(2).replace('.', ','));

export default async function FicheDistributeur({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string; q?: string; tous?: string; prod?: string }> }) {
  await exigerAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getDistributeur(id);
  if (!d) notFound();
  const [tous, producteurs, duTarif, cuvees, aCompleter, aRecadrer, restos] = await Promise.all([getVinsDistributeur(id),
    requete<{ nom: string }>(`select distinct nom from producteur where statut <> 'retire' order by nom`), getProducteursDistributeur(id), getCuveesDistributeur(id), vinsACompleter(id), photosARecadrer(id), restaurantsDistributeur(id)]);
  const aRelier = duTarif.filter((p) => p.nom && !p.producteur_id);
  const sansProposition = aRelier.filter((p) => !p.suggestions.length).length;
  const listeProducteurs = sp.prod === 'tous' ? duTarif : duTarif.filter((p) => p.nom && (!p.producteur_id || p.base_statut === 'propose'));
  const vinsHorsBase = tous.filter((v) => v.actif && v.producteur_id && !v.cuvee_id).length;
  const q = sansAccents(sp.q?.trim() ?? '');
  const vins = tous.filter((v) => (sp.tous || v.actif) && (!q || sansAccents(`${v.producteur_texte ?? ''} ${v.libelle} ${v.millesime ?? ''} ${v.producteur_nom ?? ''} ${v.section ?? ''}`).includes(q)));
  const actifs = tous.filter((v) => v.actif);
  // Vins proposés sans prix pour les restaurants : ni prix public sur le tarif, ni remise QV pour le retrouver depuis le prix QV.
  const sansPrix = actifs.filter((v) => prixRestaurant(v.prix_catalogue != null ? Number(v.prix_catalogue) : null, v.prix_qv != null ? Number(v.prix_qv) : null, d.remise_qv, 0) == null).length;
  const rattaches = actifs.filter((v) => v.producteur_id).length;
  const dansLaBase = actifs.filter((v) => v.cuvee_id).length;
  // Lecture interrompue (serveur redémarré) : au-delà de 30 minutes, on propose de la relancer.
  const enCours = d.lecture_statut === 'en_cours' && d.lecture_le && Date.now() - new Date(d.lecture_le).getTime() < 30 * 60_000;
  // L'avancement est noté à chaque lot : sans nouvelle depuis 15 minutes, la recherche a été interrompue (serveur redémarré).
  // Bilan de l'ancienne recherche des étiquettes sur le web (retirée) : plus affiché
  const bilan = d.completion_statut && !(d.completion_message ?? '').startsWith('Photos sur le web') && !(d.completion_message ?? '').startsWith('Recherche des photos sur le web') ? d.completion_statut : null;
  const calculQv = d.calcul_qv === 'remise' && d.remise_qv != null;
  // Recherche vivante : son avancement a bougé depuis moins de 5 minutes (il bouge au moins toutes les deux ou trois minutes).
  // Au-delà, elle a été arrêtée (redémarrage du site, mise en ligne) : le bouton revient pour la reprendre.
  const rechercheEnCours = d.completion_statut === 'en_cours' && d.completion_le && Date.now() - new Date(d.completion_le).getTime() < 5 * 60_000;
  const domaine = domaineDuSite(d.site);

  return (
    <>
      <Entete titre={d.nom} texte="Les vins du distributeur : prix publics et prix QV (après la remise de Quid Vinum). Chaque restaurant achète au prix public moins sa remise, comme en direct ; il ne voit ni le prix QV ni la commission.">
        <Link href="/admin/super/distributeurs" className="btn sec">← Distributeurs</Link>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      {sansPrix > 0 && (
        <div className="carte-bo" role="alert" style={{ borderColor: 'var(--ocre)', color: 'var(--ocre)' }}>
          <b>{sansPrix} vin{sansPrix > 1 ? 's' : ''} sans prix pour les restaurants.</b> Le tarif ne donne pas leur prix public : indiquez la <b>remise QV</b> dans
          « Coordonnées, logo et remises » (le prix public est alors recalculé depuis le prix QV), ou saisissez leur prix public dans la liste des vins.
        </div>
      )}
      {(enCours || rechercheEnCours) && <ActualisationAuto secondes={8} />}

      <div className="rangee">
        <div className="large" style={{ gap: 16 }}>
          <details className="carte-bo bloc-fiche bloc-distrib">
            <summary style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.logo_url && <img src={d.logo_url} alt="" className="logo-distributeur" />}
              <b style={{ fontSize: 17 }}>Coordonnées, logo et remises</b> <span className="discret">{`· remise des restaurants ${String(d.remise_restaurant).replace('.', ',')} % `}{d.remise_qv != null ? `· remise QV ${String(d.remise_qv).replace('.', ',')} %${calculQv ? ' (prix QV calculés)' : ''}` : ''}{d.actif ? '' : ' · masqué aux restaurants'}</span></summary>
            <div className="grille-coordonnees">
            <FormulaireAdmin action={enregistrerDistributeur.bind(null, id)} className="pile" style={{ marginTop: 14 }}>
            <div className="champ"><label htmlFor="nom">Nom</label><input id="nom" name="nom" defaultValue={d.nom} required /></div>
            <div className="champ"><label htmlFor="remise_qv">Remise QV (%)</label><input id="remise_qv" name="remise_qv" inputMode="decimal" defaultValue={d.remise_qv != null ? String(d.remise_qv).replace('.', ',') : ''} /><span className="aide">remise du distributeur à Quid Vinum sur ses prix publics</span></div>
            <div className="champ"><label htmlFor="remise_restaurant">Remise des restaurants (%)</label><input id="remise_restaurant" name="remise_restaurant" inputMode="decimal" defaultValue={String(d.remise_restaurant).replace('.', ',')} /><span className="aide">remise habituelle d’un restaurant qui commande en direct (ex. 8) ; modifiable par restaurant</span></div>
            <div className="champ"><label htmlFor="calcul_qv">Prix QV</label>
              <select id="calcul_qv" name="calcul_qv" defaultValue={d.calcul_qv}>
                <option value="liste">Lus dans la liste du distributeur (prix barré = prix public)</option>
                <option value="remise">Calculés : prix public moins la remise QV</option>
              </select><span className="aide">en « calculés », les prix QV sont recalculés dès l’enregistrement</span></div>
            <label className="petit" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="actif" defaultChecked={d.actif} /> Proposé aux restaurants</label>
            <div className="champ"><label htmlFor="logo">Logo</label><input id="logo" name="logo" type="file" accept="image/*" />
              {d.logo_url ? <label className="aide" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="retirer_logo" /> Retirer le logo actuel</label> : <span className="aide">PNG, JPG, WebP ou SVG de préférence (une autre image est convertie)</span>}</div>
            <div className="champ"><label htmlFor="source">Source du tarif</label>
              <select id="source" name="source" defaultValue={d.source}><option value="fichier">Fichier déposé (PDF, Word, Excel ou CSV)</option><option value="api">API du distributeur</option></select></div>
            <div className="champ"><label htmlFor="modele_lecture">Lecture par Claude</label>
              <select id="modele_lecture" name="modele_lecture" defaultValue={d.modele_lecture}>
                <option value="sonnet">Sonnet (conseillé)</option><option value="haiku">Haiku (le moins cher)</option><option value="opus">Opus (le plus précis, le plus cher)</option>
              </select><span className="aide">pour les PDF, et les tableaux dont les colonnes ne sont pas reconnues</span></div>
            <div className="champ"><label htmlFor="contact">Contact</label><input id="contact" name="contact" defaultValue={d.contact ?? ''} /></div>
            <div className="champ"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={d.email ?? ''} /></div>
            <div className="champ"><label htmlFor="telephone">Téléphone</label><input id="telephone" name="telephone" defaultValue={d.telephone ?? ''} /></div>
            <div className="champ"><label htmlFor="site">Site</label><input id="site" name="site" defaultValue={d.site ?? ''} /></div>
            <div className="champ"><label htmlFor="presentation">Présentation pour les restaurants</label>
              <textarea id="presentation" name="presentation" rows={3} maxLength={400} defaultValue={d.presentation ?? ''} placeholder="Ex. Importateur de vins d’Italie depuis 1985 : vignerons familiaux, bio pour la plupart." />
              <span className="aide">Deux phrases au plus, montrées aux restaurants à côté du nom, avec le lien vers le site.</span></div>
            <div className="champ"><label htmlFor="adresse">Adresse</label><textarea id="adresse" name="adresse" rows={2} defaultValue={d.adresse ?? ''} /></div>
            <div className="champ"><label htmlFor="tva">TVA</label><input id="tva" name="tva" defaultValue={d.tva ?? ''} /></div>
            <div className="champ"><label htmlFor="notes">Notes (internes)</label><textarea id="notes" name="notes" rows={3} defaultValue={d.notes ?? ''} /></div>
            <div className="ligne-actions"><button className="btn">Enregistrer</button>
              <BoutonSupprimer action={supprimerDistributeur.bind(null, id)} libelle="Supprimer ce distributeur" enCoursLibelle="Suppression…" className="btn fantome petit"
            question={`Supprimer « ${d.nom} », ses tarifs et ses vins ? Les restaurants qui l’avaient choisi le gardent comme simple fournisseur.`} /></div>
          </FormulaireAdmin>
            </div>
          </details>
          <details className="carte-bo pile bloc-fiche bloc-distrib" open={Boolean(sp.ok || sp.erreur)}>
            <summary><h2 style={{ margin: 0 }}>Tarif</h2><span className="petit discret">{d.source === 'api' ? 'API du distributeur' : 'Fichier ou liste collée'}</span></summary>
            <div><p className="sous">{d.source === 'api'
              ? 'Le tarif est lu depuis l’API du distributeur. Un tableau dont les colonnes sont reconnues est lu sans IA ; sinon, par Claude.'
              : 'Déposez le tarif : un PDF ou un document Word (leur texte est lu par Claude, le modèle choisi dans les coordonnées ; les photos d’un document Word vont aux vins), ou un fichier Excel ou CSV (ses colonnes sont reconnues sans IA quand c’est possible).'}
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
                    <input type="file" name="tarif" accept="application/pdf,.xlsx,.docx,.csv,text/csv" required aria-label="Tarif du distributeur (PDF, Excel, Word ou CSV)" />
                    <button className="btn" disabled={Boolean(enCours)}>Déposer et lire le tarif</button>
                    <label className="petit" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="ajout" /> Ajouter à la liste existante (tarif en plusieurs fichiers : rien n’est retiré)</label>
                  </form>
                  {d.tarif_nom && !enCours && <FormulaireAdmin action={relireTarif.bind(null, id)}><button className="btn fantome petit" style={{ paddingLeft: 0 }}>Relire le dernier fichier</button></FormulaireAdmin>}
                  <details>
                    <summary className="petit" style={{ cursor: 'pointer' }}>Ou coller la liste copiée depuis le site du distributeur (avec les étiquettes)</summary>
                    <div style={{ marginTop: 10 }}><CollageTarif action={collerTarif.bind(null, id)} desactive={Boolean(enCours)} /></div>
                  </details>
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
          </details>

          <details className="carte-bo pile bloc-fiche bloc-distrib" id="base" open={sp.prod !== undefined}>
            <summary><h2 style={{ margin: 0 }}>Producteurs et base Quid Vinum</h2><span className="petit discret">{duTarif.filter((p) => p.producteur_id).length} reliés · {aRelier.length} à relier</span></summary>
            <div><p className="sous">Chaque producteur du tarif est relié à la base de Pat : celui que Pat a reconnu (avec son ranking), un producteur proche à choisir, ou ajouté à la base, à valider dans Producteurs. Le choix vaut pour tous ses vins, et pour les prochains tarifs.</p></div>
            <div className="ligne-actions" style={{ alignItems: 'center' }}>
              <span><b>{duTarif.filter((p) => p.producteur_id).length}</b> reliés · <b>{aRelier.length}</b> à relier</span>
              <Link href={`?prod=${sp.prod === 'tous' ? '' : 'tous'}#base`} className="btn fantome petit">{sp.prod === 'tous' ? 'Seulement ceux à relier ou à valider' : `Voir les ${duTarif.length} producteurs`}</Link>
              {sansProposition > 0 && <FormulaireAdmin action={ajouterProducteursSansProposition.bind(null, id)}><button className="btn sec petit">Ajouter à la base les {sansProposition} producteurs sans proposition</button></FormulaireAdmin>}
            </div>
            {!listeProducteurs.length && <p className="discret" style={{ margin: 0 }}>{duTarif.length ? 'Tous les producteurs sont reliés à la base de Pat.' : 'Aucun producteur pour l’instant.'}</p>}
            <div className="pile" style={{ gap: 0 }}>
              {listeProducteurs.map((p) => (
                <div key={p.nom || '-'} className="ligne-producteur">
                  <div style={{ flex: '1 1 260px' }}>
                    <b>{p.nom || 'Producteur non indiqué'}</b> <span className="discret petit">· {p.vins} vin{p.vins > 1 ? 's' : ''}</span>
                    {p.producteur_id && (
                      <div className="petit">Base de Pat : <Link href={`/admin/super/producteurs/${p.producteur_id}`}><b>{p.base_nom}</b></Link>{' '}
                        <span title="Ranking de Pat" style={{ color: 'var(--encre)' }}>{ranking(p.ranking_pat)}</span>
                        {p.base_statut === 'propose' && <> · <Etat type="attention">à valider</Etat></>}{!p.manuel && <span className="discret"> · trouvé par Pat</span>}</div>
                    )}
                  </div>
                  {p.nom && (
                    <div className="pile" style={{ gap: 6, flex: '2 1 380px' }}>
                      {!p.producteur_id && p.suggestions.map((s) => (
                        <FormulaireAdmin key={s.id} action={associerProducteur.bind(null, id, p.nom, s.id)} className="ligne-actions" style={{ alignItems: 'center' }}>
                          <button className="btn sec petit">Associer</button>
                          <span className="petit"><b>{s.nom}</b> <span style={{ color: 'var(--encre)' }}>{ranking(s.ranking_pat)}</span>{s.region && <span className="discret"> · {s.region}</span>}{s.statut === 'propose' && <span className="discret"> · à valider</span>}</span>
                        </FormulaireAdmin>
                      ))}
                      <div className="ligne-actions" style={{ alignItems: 'center' }}>
                        {!p.producteur_id && <FormulaireAdmin action={ajouterProducteur.bind(null, id, p.nom)}><button className="btn fantome petit" style={{ paddingLeft: 0 }}>+ Ajouter « {p.nom} » à la base</button></FormulaireAdmin>}
                        <details>
                          <summary className="petit" style={{ cursor: 'pointer' }}>{p.producteur_id ? 'Changer' : 'Autre producteur de la base…'}</summary>
                          <FormulaireAdmin action={associerProducteur.bind(null, id, p.nom, null)} className="ligne-actions" style={{ alignItems: 'center', marginTop: 6 }}>
                            <input name="nom_base" list="producteurs-base" className="champ-liste" placeholder="Nom dans la base de Pat" aria-label={`Producteur de la base pour ${p.nom}`} style={{ minWidth: 240, width: 'auto' }} />
                            <button className="btn sec petit">Associer</button>
                          </FormulaireAdmin>
                          {p.producteur_id && <FormulaireAdmin action={retirerLienProducteur.bind(null, id, p.nom)}><button className="btn fantome petit" style={{ paddingLeft: 0 }}>Retirer le lien</button></FormulaireAdmin>}
                        </details>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>

          <details className="carte-bo pile bloc-fiche bloc-distrib" style={{ gap: 10 }}>
            <summary><h2 style={{ margin: 0 }}>Restaurants et remises</h2><span className="petit discret">{restos.length} restaurant{restos.length > 1 ? 's' : ''}</span></summary>
            <div>
              <p className="sous" style={{ margin: '4px 0 0' }}>Prix du restaurant (HTVA) = prix public moins sa remise, comme s’il commandait en direct. Vide : la remise du distributeur ({String(d.remise_restaurant).replace('.', ',')} %). Les restaurants ne voient ni le prix QV ni la commission de Quid Vinum.</p></div>
            {restos.length ? (
              <FormulaireAdmin action={enregistrerRemises.bind(null, id)} className="pile" style={{ gap: 8 }}>
                {restos.map((r) => (
                  <label key={r.fournisseur_id} className="ligne-actions" style={{ alignItems: 'center' }}>
                    <span style={{ minWidth: 200 }}><b>{r.restaurant}</b></span>
                    <span className="champ-prix"><input type="text" inputMode="decimal" name={`remise_${r.fournisseur_id}`} defaultValue={r.remise != null ? String(r.remise).replace('.', ',') : ''} placeholder={String(d.remise_restaurant).replace('.', ',')} aria-label={`Remise : ${r.restaurant}`} /> %</span>
                  </label>
                ))}
                <span><button className="btn sec petit">Enregistrer les remises</button></span>
              </FormulaireAdmin>
            ) : <span className="petit discret">Aucun restaurant n’a encore activé ce distributeur.</span>}
          </details>

          <details className="carte-bo pile bloc-fiche bloc-distrib" open={sp.q !== undefined || sp.tous !== undefined}>
            <summary><h2 style={{ margin: 0 }}>Vins</h2><span className="petit discret">{actifs.length} proposés · {rattaches} d’un producteur de la base · {dansLaBase} vins de la base</span></summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Link href={`/admin/super/vins?${new URLSearchParams({ distrib: id, statut: 'propose' })}`} className="btn fantome petit">Voir ses vins à valider dans la base →</Link>
              <form className="ligne-actions" style={{ alignItems: 'center' }}>
                <input name="q" defaultValue={sp.q ?? ''} type="search" className="recherche" placeholder="Chercher un vin, un domaine…" aria-label="Chercher" />
                <label className="petit" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="tous" value="1" defaultChecked={Boolean(sp.tous)} /> Avec les vins retirés</label>
                <button className="btn sec petit">Filtrer</button>
              </form>
            </div>
            <datalist id="producteurs-base">{producteurs.map((p) => <option key={p.nom} value={p.nom} />)}</datalist>
            {(aCompleter.n > 0 || aCompleter.hors_base > 0 || aRecadrer > 0 || bilan) && (
              <div className="carte-bo pile" style={{ gap: 8 }}>
                <div className="ligne-actions" style={{ alignItems: 'center' }}>
                  <b>Cépages, appellations et étiquettes</b>
                  {aCompleter.n > 0 && <span className="petit">{aCompleter.n} vin{aCompleter.n > 1 ? 's' : ''} de la base sans cépages, sans appellation ou sans photo
                    {aCompleter.deja > 0 && <> (dont {aCompleter.deja} déjà cherché{aCompleter.deja > 1 ? 's' : ''} sans tout trouver)</>}.</span>}
                  {aCompleter.n > 0 && !rechercheEnCours && (
                    <FormulaireAdmin action={completerVins.bind(null, id)} className="ligne-actions" style={{ alignItems: 'center' }}>
                      <button className="btn sec petit">
                        {d.completion_statut === 'en_cours' ? 'Reprendre la recherche' : aCompleter.n > aCompleter.deja ? `Chercher les ${aCompleter.n - aCompleter.deja} sur ${domaine ?? 'le web'}` : `Chercher sur ${domaine ?? 'le web'}`}</button>
                      {aCompleter.deja > 0 && <label className="petit" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="aussi_deja" defaultChecked={aCompleter.n === aCompleter.deja} /> aussi les {aCompleter.deja} déjà cherchés</label>}
                    </FormulaireAdmin>
                  )}
                </div>
                {aRecadrer > 0 && !rechercheEnCours && (
                  <FormulaireAdmin action={recadrerPhotos.bind(null, id)} className="ligne-actions" style={{ alignItems: 'center' }}>
                    <span className="petit">{aRecadrer} photo{aRecadrer > 1 ? 's' : ''} pas encore recadrée{aRecadrer > 1 ? 's' : ''} sur l’étiquette :</span>
                    <button className="btn sec petit">Recadrer sur l’étiquette</button>
                    <span className="petit discret">(une photo de bouteille devient son étiquette ; moins d’un centime par photo)</span>
                  </FormulaireAdmin>
                )}
                {aCompleter.hors_base > 0 && <span className="petit discret">Et {aCompleter.hors_base} ligne{aCompleter.hors_base > 1 ? 's' : ''} du tarif pas encore dans la base (producteur à relier, plus haut) : elles seront cherchées une fois leur producteur relié. Plusieurs millésimes ou formats d’un même vin ne font qu’une fiche dans la base.</span>}
                {!domaine && <span className="petit" style={{ color: 'var(--ocre)' }}>Renseignez le site du distributeur (Coordonnées) : la recherche s’y limitera.</span>}
                {bilan && (
                  <span className="petit">{rechercheEnCours ? <Etat type="propose">Recherche en cours…</Etat> : d.completion_statut === 'terminee' ? <Etat type="ok">Terminée</Etat> : d.completion_statut === 'echec' ? <Etat type="attention">Échec</Etat> : <Etat type="attention">Interrompue</Etat>}
                    {' '}{d.completion_message}{d.completion_le && <span className="discret"> · {date(d.completion_le)}</span>}
                    {d.completion_statut === 'en_cours' && !rechercheEnCours && <span> — interrompue (le site a sans doute redémarré) : « Reprendre la recherche » continue avec les vins encore incomplets.</span>}</span>
                )}
              </div>
            )}
            {vinsHorsBase > 0 && (
              <FormulaireAdmin action={ajouterVinsBase.bind(null, id)} className="ligne-actions" style={{ alignItems: 'center' }}>
                <span className="petit">{vinsHorsBase} vin{vinsHorsBase > 1 ? 's' : ''} de producteurs reliés ne {vinsHorsBase > 1 ? 'sont' : 'est'} pas encore dans la base de Pat.</span>
                <button className="btn sec petit">Les ajouter à la base (à valider)</button>
              </FormulaireAdmin>
            )}
            <FormulaireAdmin action={enregistrerVins.bind(null, id)} className="pile" style={{ gap: 12 }}>
              <div className="carte-bo" style={{ padding: 0 }}>
                <div className="tableau">
                  <table style={{ minWidth: 760 }}>
                    <thead><tr><th>Vin</th><th>Base de Pat</th><th className="droite">Prix public (HTVA)</th><th className="droite">Prix QV (HTVA){calculQv && <span className="discret" style={{ fontWeight: 400 }}> −{String(d.remise_qv).replace('.', ',')} %</span>}</th><th className="droite">Restaurant (HTVA)<span className="discret" style={{ fontWeight: 400 }}> −{String(d.remise_restaurant).replace('.', ',')} %</span></th><th className="droite">Proposé</th></tr></thead>
                    <tbody>
                      {!vins.length && <tr><td colSpan={5} className="discret">{tous.length ? 'Aucun vin ne correspond.' : 'Aucun vin : déposez le tarif ci-dessus, ou ajoutez les vins à la main.'}</td></tr>}
                      {vins.map((v) => (
                        <tr key={v.id} style={v.actif ? undefined : { opacity: 0.55 }}>
                          <td>
                            <div className="vin-cell"><Vignette url={v.etiquette_url} taille={36} /><div>
                            <div className="nom"><b>{v.libelle}</b>{v.millesime ? ` ${v.millesime}` : ''}{v.contenance ? <span className="discret"> · {v.contenance}</span> : null}</div>
                            <div className="petit">{v.producteur_texte ?? <span className="discret">producteur non indiqué</span>}{v.certification ? ` · ${v.certification}` : ''}{v.section ? <span className="discret"> · {v.section}</span> : null}
                              {v.epuise && <> · <b style={{ color: 'var(--rouge, #FF0D05)' }}>Épuisé</b></>}{v.maximum != null && <> · Max. {v.maximum}</>}
                              {v.reference && <span className="discret"> · réf. {v.reference}</span>}</div>
                            </div></div>
                          </td>
                          <td>{v.producteur_id ? <>
                            <div className="petit"><b>{v.producteur_nom}</b></div>
                            <select name={`cuvee_${v.id}`} defaultValue={v.cuvee_id ?? ''} className="champ-liste" aria-label={`Vin de la base : ${v.libelle}`}>
                              <option value="">— pas encore dans la base —</option>
                              {cuvees.filter((c) => c.producteur_id === v.producteur_id).map((c) => <option key={c.id} value={c.id}>{c.nom}{c.statut === 'propose' ? ' (à valider)' : ''}</option>)}
                            </select>
                          </> : <a href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.tous ? { tous: sp.tous } : {}), prod: '' })}#base`} className="petit discret">producteur à relier</a>}</td>
                          <td className="droite"><span className="champ-prix"><input type="text" inputMode="decimal" name={`publie_${v.id}`} defaultValue={virgule(v.prix_catalogue)} placeholder="—" aria-label={`Prix public : ${v.libelle}`} /> €</span></td>
                          <td className="droite">{calculQv && v.prix_catalogue != null
                            ? <><input type="hidden" name={`prix_${v.id}`} value={virgule(v.prix_qv)} /><span style={{ whiteSpace: 'nowrap' }}>{v.prix_qv == null ? '—' : euros(Number(v.prix_qv))}</span></>
                            : <span className="champ-prix"><input type="text" inputMode="decimal" name={`prix_${v.id}`} defaultValue={virgule(v.prix_qv)} aria-label={`Prix QV : ${v.libelle}`} /> €</span>}</td>
                          {/* Prix du restaurant avec la remise par défaut : prix public (sinon recalculé depuis le prix QV) moins la remise. */}
                          <td className="droite" style={{ whiteSpace: 'nowrap' }}>{(() => { const p = prixRestaurant(v.prix_catalogue != null ? Number(v.prix_catalogue) : null, v.prix_qv != null ? Number(v.prix_qv) : null, d.remise_qv, d.remise_restaurant); return p == null ? <span className="discret" title="Pas de prix public ni de remise QV : pas de prix pour les restaurants">—</span> : euros(p); })()}</td>
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
                <div className="champ"><label htmlFor="n-publie">Prix public (HTVA)</label><input id="n-publie" name="publie" inputMode="decimal" /></div>
                {!calculQv && <div className="champ"><label htmlFor="n-prix">Prix QV (HTVA)</label><input id="n-prix" name="prix" inputMode="decimal" /></div>}
                <span><button className="btn sec">Ajouter</button></span>
              </FormulaireAdmin>
            </details>
          </details>
        </div>

      </div>
    </>
  );
}
