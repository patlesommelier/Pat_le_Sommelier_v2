// Gestion des stocks — Commandes de vin : les commandes ouvertes (bon de commande PDF, envoi au fournisseur, réception),
// puis « + Nouvelle commande » : une fenêtre où l’on choisit le distributeur, puis les bouteilles (avec leur stock actuel).
import Link from 'next/link';
import { annulerCommande, creerCommande, creerCommandeQv, envoyerCommande, marquerEnvoyee, recevoirBouteilles } from '../../stocks-actions';
import { EnvoiCommande } from '@/components/admin/EnvoiCommande';
import { CatalogueCommande, type LigneCatalogue } from '@/components/admin/CatalogueCommande';
import { ChoixCommande, Panneau } from '@/components/admin/ChoixCommande';
import { Superposition } from '@/components/admin/Superposition';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { commandeVerrouillee, getCommandes, getCoordonnees, getFournisseurs, getPrixAchat, stockBas, type Commande } from '@/lib/admin/stocks';
import { euros, referenceCommande } from '@/lib/bon-commande';
import { envoiEmailConfigure } from '@/lib/email';
import { catalogueDistributeur } from '@/lib/distributeurs/donnees';
import { vinDeLaCarte } from '@/lib/distributeurs/tarif';
import { nomPourListe, regrouperVins } from '../carte/etats';
import { VignetteVin } from '@/components/admin/VignetteVin';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { STATUTS_QV } from '@/lib/super/commandes';

const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' });
// Suivi Quid Vinum, tel que le restaurant le lit.
// Commande Quid Vinum envoyée : son statut suit Quid Vinum (en attente de validation, acceptée, envoyée au distributeur…).
const SUIVI_QV: Record<string, string> = { recue: 'Commande envoyée · en attente de validation', acceptee: 'Commande acceptée', envoyee_distributeur: 'Commande envoyée au distributeur',
  livree_partielle: 'Livraison partielle', livree: 'Bouteilles livrées', facturee: 'Bouteilles facturées' };
const total = (c: Commande) => c.lignes.reduce((n, l) => n + l.quantite, 0);

export default async function Commandes({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ commande?: string; f?: string; vin?: string; ok?: string; catalogue?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const sp = await searchParams;
  const [vins, r, fournisseurs, ouvertes, recues, coord, achats] = await Promise.all([getVinsBO(resto), getRestaurantBO(resto), getFournisseurs(resto),
    getCommandes(resto, ['ouverte']), getCommandes(resto, ['recue', 'annulee'], 20), getCoordonnees(resto), getPrixAchat(resto)]);
  const limite = r?.stock_limite_basse ?? 2;
  const emailPret = envoiEmailConfigure();
  const groupes = regrouperVins(vins).filter((g) => g.tous.some((x) => x.disponible));
  // Nouvelle commande : un bloc par fournisseur qui a des vins, puis les vins sans fournisseur.
  // Distributeur Quid Vinum : son catalogue au prix proposé, chaque vin relié à la carte quand il y figure.
  const carteSimple = groupes.map((g) => ({ id: g.principal.id, libelle: g.principal.libelle, millesime: g.principal.millesime, format: g.principal.format,
    producteur_id: g.principal.producteur_id, producteur: g.principal.producteur_texte ?? g.principal.producteur_nom ?? null }));
  const catalogues = new Map(await Promise.all(fournisseurs.filter((f) => f.distributeur_id).map(async (f) => {
    const lignes: LigneCatalogue[] = (await catalogueDistributeur(f.distributeur_id!, resto)).map((c) => {
      const surCarte = groupes.find((g) => g.principal.distributeur_vin_id === c.id)?.principal
        ?? groupes.find((g) => g.principal.id === vinDeLaCarte(c, carteSimple)?.id)?.principal;
      return { id: c.id, section: c.section, producteur: c.producteur, libelle: c.libelle, millesime: c.millesime, contenance: c.contenance, prix: c.prix,
        epuise: c.epuise, maximum: c.maximum, etiquette: c.etiquette_url, surCarte: surCarte ? { stock: surCarte.stock, enCommande: surCarte.en_commande, bas: stockBas(surCarte.stock, limite) } : null };
    });
    return [f.id, lignes] as const;
  })));
  // Distributeurs Quid Vinum activés : une seule commande pour tous (Quid Vinum la répartit entre eux).
  const qv = fournisseurs.filter((f) => f.distributeur_id && catalogues.get(f.id)?.length);
  const vinChoisi = groupes.find((g) => g.tous.some((x) => x.id === sp.vin))?.principal.distributeur_vin_id ?? undefined;
  // Vins de la carte vendus par ces distributeurs : groupés par distributeur (section), en tête de la commande Quid Vinum.
  const surLaCarteQv = qv.flatMap((f) => (catalogues.get(f.id) ?? []).filter((l) => l.surCarte).map((l) => ({ ...l, section: f.nom, distributeur: undefined })));
  const blocs = [
    ...fournisseurs.filter((f) => !f.distributeur_id).map((f) => ({ id: f.id, nom: f.nom, email: f.email, logo: f.logo_url, groupes: groupes.filter((g) => g.principal.fournisseur_id === f.id), catalogue: catalogues.get(f.id) }))
      .filter((b) => b.groupes.length || b.catalogue?.length),
    // Pas de commande sans distributeur : un vin sans distributeur se commande une fois son distributeur choisi (page Vins).
  ].filter((b) => b.groupes.length || b.catalogue?.length);
  const cible = sp.f === 'aucun' ? '' : sp.f === 'qv' || qv.some((f) => f.id === sp.f) ? 'qv' : sp.f;
  const basQv = qv.reduce((n, f) => n + (catalogues.get(f.id) ?? []).filter((l) => l.surCarte?.bas).length, 0);
  const sansCoordonnees = !coord?.commande_email || !coord.commande_adresse;

  const carte = (c: Commande) => {
    const ref = referenceCommande({ numero: c.numero, date: new Date(c.cree_le) });
    const nomResto = coord?.commande_societe || coord?.nom || '';
    const sujet = `Bon de commande ${ref} — ${nomResto}${c.via_qv ? ` — ${c.fournisseur_nom}` : ''}`;
    const corps = `Bonjour,\n\nVeuillez trouver ci-joint notre bon de commande n° ${ref} (${total(c)} bouteille${total(c) > 1 ? 's' : ''}) :\n\n${c.lignes.map((l) => `- ${l.quantite} × ${l.libelle}${l.prix_achat != null ? ` à ${euros(l.prix_achat)} HTVA` : ''}`).join('\n')}\n\nMerci de nous confirmer la commande et la date de livraison.\n\n${nomResto}`;
    const envoyee = Boolean(c.envoyee_le);
    const recues = c.lignes.reduce((n, l) => n + l.recue, 0);
    return (
      <article key={c.id} id={`commande-${c.id}`} className={`carte-bo pile commande${sp.commande === c.id ? ' choisie' : ''}`} style={{ gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="pile" style={{ gap: 2 }}>
            <span className="surtitre">Commande n° {ref} · {date(c.cree_le)}{c.reference_interne ? ` · réf. interne ${c.reference_interne}` : ''}</span>
            <b style={{ fontSize: 18 }}>{c.fournisseur_nom}</b>
          </span>
          {/* Statut, bien visible : à envoyer → commande envoyée → réception partielle → bouteilles réceptionnées (ou annulée). */}
          {/* À côté du statut : ce que Quid Vinum partage (la suite après l'acceptation, la date de mise à jour). */}
          <span className="pile statut-bloc">
          <span className="statut-commande">{c.statut === 'ouverte'
            ? (recues ? <Etat type="propose">Réception partielle : {recues} / {total(c)} bouteilles</Etat>
              : envoyee && c.via_qv ? (c.statut_qv && c.statut_qv !== 'recue'
                ? <span className="statut-qv-resto"><span className="coche-acceptee" role="img" aria-label="Commande acceptée par Quid Vinum" title="Commande acceptée par Quid Vinum">✓</span>
                  <span className="etat statut-qv" data-statut={c.statut_qv}>{STATUTS_QV.find(([k]) => k === c.statut_qv)?.[1] ?? c.statut_qv}</span></span>
                : <Etat type="propose">{SUIVI_QV.recue}</Etat>)
              : envoyee ? <Etat type="propose">Commande envoyée le {date(c.envoyee_le!)}</Etat> : <Etat type="attention">À envoyer</Etat>)
            : c.statut === 'recue' ? <Etat type="ok">Bouteilles réceptionnées le {date(c.recue_le!)}</Etat>
            : c.statut_qv === 'refusee' ? <Etat type="attention">Commande refusée</Etat> : <Etat type="defaut">Annulée</Etat>}</span>
          {c.via_qv && c.statut === 'ouverte' && c.statut_qv === 'acceptee' && <span className="info-statut vert">Vous recevrez bientôt des informations concernant la livraison.</span>}
          {c.via_qv && envoyee && c.statut_qv_le && c.statut !== 'annulee' && <span className="info-statut">Envoyée le {date(c.envoyee_le!)} · mise à jour le {date(c.statut_qv_le)}</span>}
          </span>
        </div>
        {c.statut_qv === 'refusee' && c.motif_refus && <p className="message" style={{ margin: 0, background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Quid Vinum a refusé cette commande : {c.motif_refus}</p>}
        {/* Détail de la commande : photo, vin, bouteilles, prix et total de chaque ligne ; la somme en dessous. */}
        <div className="tableau tableau-commande"><table>
          <thead><tr><th>Vin</th><th className="droite">Bouteilles</th><th className="droite">Prix HTVA</th><th className="droite">Total HTVA</th></tr></thead>
          <tbody>{c.lignes.map((l, i) => (
            <tr key={i}>
              <td><div className="vin-cell"><VignetteVin url={l.etiquette} logo={l.logo} taille={44} />
                <div><div className="vin-commande">{l.libelle}</div>{l.detail && <div className="petit discret">{l.detail}</div>}
                  {c.statut === 'ouverte' && l.recue > 0 && <div className="petit recue">{l.recue >= l.quantite ? 'reçu' : `${l.recue} reçue${l.recue > 1 ? 's' : ''}`}</div>}</div></div></td>
              <td className="droite"><b>{l.quantite}</b></td>
              <td className="droite">{l.prix_achat != null ? euros(l.prix_achat) : '—'}</td>
              <td className="droite"><b>{l.prix_achat != null ? euros(l.prix_achat * l.quantite) : '—'}</b></td>
            </tr>
          ))}</tbody>
          <tfoot><tr>
            <td><b>Total de la commande</b></td>
            <td className="droite"><b>{total(c)}</b></td>
            <td />
            <td className="droite"><b className="total-commande">{c.lignes.some((l) => l.prix_achat != null) ? `${euros(c.lignes.reduce((n, l) => n + (l.prix_achat ?? 0) * l.quantite, 0))} HTVA` : '—'}</b></td>
          </tr></tfoot>
        </table></div>
        {/* Toutes les actions sur une ligne. */}
        <div className="actions-commande">
          {c.statut === 'ouverte' && !envoyee && (c.fournisseur_email
            ? <EnvoiCommande pdf={`/admin/${resto}/commandes/${c.id}/pdf`} fichier={`bon-de-commande-${ref}.pdf`} email={c.fournisseur_email} sujet={sujet} corps={corps}
                serveur={emailPret} envoyer={envoyerCommande.bind(null, resto, c.id)} marquer={marquerEnvoyee.bind(null, resto, c.id)} deja={envoyee} petit />
            : <Link href={`/admin/${resto}/commandes/${c.id}`} className="btn rouge petit">Envoyer la commande</Link>)}
          {/* Le bon de commande : sa page (aperçu du PDF, et l'envoyer ou le renvoyer). */}
          <Link href={`/admin/${resto}/commandes/${c.id}`} className="btn sec petit">Bon de commande (PDF)</Link>
          {c.receptions.map((r) => (
            <a key={r.id} href={`/admin/${resto}/commandes/${c.id}/reception/${r.id}`} target="_blank" rel="noopener" className="btn fantome petit">
              Bon de réception {r.numero}{r.complete ? '' : ' (partielle)'}</a>
          ))}
          {c.statut === 'ouverte' && !commandeVerrouillee(c) && (
            <BoutonSupprimer action={annulerCommande.bind(null, resto, c.id)} libelle="Annuler" enCoursLibelle="Annulation…" className="btn fantome petit"
              question={`Annuler la commande à ${c.fournisseur_nom} ? Les bouteilles pas encore reçues ne seront plus comptées « en commande ».`} />
          )}
          {/* Réception des bouteilles : discrète, à droite. */}
          {c.statut === 'ouverte' && (<span style={{ marginLeft: 'auto' }}>
            <Superposition bouton="Réception des bouteilles" titre={`Réception des bouteilles — commande n° ${ref}`} classeBouton="btn fantome petit">
              <FormulaireAdmin action={recevoirBouteilles.bind(null, resto, c.id)} className="pile" style={{ gap: 12 }}>
                <p className="petit discret" style={{ margin: 0 }}>Indiquez les bouteilles arrivées : elles passent en stock et un bon de réception est créé. Ce qui manque reste « en commande » pour une prochaine livraison.</p>
                <div className="tableau"><table style={{ minWidth: 520 }}>
                  <thead><tr><th>Vin</th><th className="droite">Commandées</th><th className="droite">Déjà reçues</th><th className="droite">Reçues aujourd’hui</th></tr></thead>
                  <tbody>{c.lignes.map((l) => (
                    <tr key={l.ordre}><td><b>{l.libelle}</b>{l.detail && <div className="petit discret">{l.detail}</div>}</td>
                      <td className="droite">{l.quantite}</td><td className="droite">{l.recue || '—'}</td>
                      <td className="droite">{l.recue >= l.quantite ? <span className="discret">reçu</span>
                        : <input type="number" name={`recue_${l.ordre}`} min={0} max={l.quantite - l.recue} defaultValue={l.quantite - l.recue} className="champ-commande" aria-label={`Bouteilles reçues : ${l.libelle}`} />}</td></tr>
                  ))}</tbody>
                </table></div>
                <span><button className="btn">Enregistrer la réception</button></span>
              </FormulaireAdmin>
            </Superposition></span>
          )}
        </div>
        {c.statut === 'ouverte' && !envoyee && c.via_qv && !c.fournisseur_email && <span className="petit" style={{ color: 'var(--ocre)' }}>L’adresse des commandes de Quid Vinum n’est pas encore renseignée : contactez Quid Vinum.</span>}
        {c.statut === 'ouverte' && !envoyee && !c.via_qv && !c.fournisseur_email && <span className="petit" style={{ color: 'var(--ocre)' }}>Pour envoyer le bon de commande, ajoutez l’adresse e-mail du distributeur dans <Link href={`/admin/${resto}/fournisseurs`}>Distributeurs</Link>.</span>}
      </article>
    );
  };


  // Nouvelle commande (fenêtre) : choisir le distributeur, puis indiquer les bouteilles.
  const options = [...(qv.length ? [{ id: 'qv', libelle: `Quid Vinum (${qv.map((f) => f.nom).join(', ')})${basQv ? ` · ${basQv} en stock bas` : ''}` }] : []),
    ...blocs.map((b) => { const n = b.groupes.filter((g) => stockBas(g.principal.stock, limite)).length; return { id: b.id || 'aucun', libelle: `${b.nom}${n ? ` · ${n} en stock bas` : ''}` }; })];
  const nouvelle = (
    <ChoixCommande options={options} initial={cible === '' ? 'aucun' : cible}>
      <p className="petit discret" style={{ margin: 0 }}>Indiquez les bouteilles à commander, puis validez : le bon de commande s’affiche, prêt à envoyer. Le prix d’achat HTVA se corrige ici si le distributeur l’a changé.</p>
        {!blocs.length && !qv.length && <p className="discret">Aucun vin disponible sur la carte.</p>}
        {qv.length > 0 && (
          <Panneau id="qv">
            <FormulaireAdmin action={creerCommandeQv.bind(null, resto)} className="pile" style={{ gap: 12 }}>
              <p className="petit discret" style={{ margin: 0 }}>Une seule commande pour tous vos distributeurs Quid Vinum, aux prix proposés par Quid Vinum (HTVA) : elle part chez Quid Vinum, qui la transmet à chaque distributeur.</p>
              {/* D'abord les vins de la carte (chez tous les distributeurs Quid Vinum), puis, à la demande, le reste des catalogues. */}
              <b>Vins de votre carte</b>
              {surLaCarteQv.length
                ? <CatalogueCommande lignes={surLaCarteQv} choisi={vinChoisi} sansFiltreCarte />
                : <p className="petit discret" style={{ margin: 0 }}>Aucun vin de votre carte n’est encore relié à un distributeur Quid Vinum : ajoutez-en ci-dessous.</p>}
              <details className="carte-bo" open={!surLaCarteQv.length || Boolean(sp.catalogue) || Boolean(vinChoisi && !surLaCarteQv.some((l) => l.id === vinChoisi))} style={{ padding: '12px 16px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>+ Ajouter un vin qui n’est pas sur la carte <span className="discret" style={{ fontWeight: 400 }}>(catalogues complets)</span></summary>
                <div className="pile" style={{ gap: 14, marginTop: 12 }}>
                  {/* Catalogue demandé depuis la page Distributeurs : le sien en premier. */}
                  {[...qv].sort((a, b) => Number(b.distributeur_id === sp.catalogue) - Number(a.distributeur_id === sp.catalogue)).map((f) => {
                    const reste = (catalogues.get(f.id) ?? []).filter((l) => !l.surCarte);
                    return reste.length ? (
                      <div key={f.id} className="pile" style={{ gap: 8 }}>
                        <b>{/* eslint-disable-next-line @next/next/no-img-element */}
                          {f.logo_url && <img src={f.logo_url} alt="" className="logo-distributeur" style={{ height: 24, verticalAlign: 'middle', marginRight: 8 }} />}{f.nom}</b>
                        <CatalogueCommande lignes={reste} choisi={vinChoisi} sansFiltreCarte />
                      </div>
                    ) : null;
                  })}
                </div>
              </details>
              <div className="barre-valider"><button className="btn rouge">Valider la commande Quid Vinum</button></div>
            </FormulaireAdmin>
          </Panneau>
        )}
        {blocs.map((b) => {
          return (
            <Panneau key={b.id || 'aucun'} id={b.id || 'aucun'}>
              <FormulaireAdmin action={creerCommande.bind(null, resto, b.id)} className="pile" style={{ gap: 12 }}>
                {!b.id && (fournisseurs.length
                  ? <label className="champ" style={{ maxWidth: 360 }}><span>Fournisseur de cette commande</span>
                      <select name="fournisseur" defaultValue="" required><option value="" disabled>Choisir…</option>{fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}</select></label>
                  : <p className="petit" style={{ color: 'var(--ocre)', margin: 0 }}>Ajoutez d’abord vos fournisseurs dans <Link href={`/admin/${resto}/fournisseurs`}>Fournisseurs</Link>, puis choisissez celui de chaque vin dans Stocks.</p>)}
                {b.catalogue ? <>
                  <p className="petit discret" style={{ margin: 0 }}>Prix proposés par Quid Vinum (HTVA). Votre commande part chez Quid Vinum, qui la transmet à {b.nom}.</p>
                  <CatalogueCommande lignes={b.catalogue} choisi={groupes.find((g) => g.tous.some((x) => x.id === sp.vin))?.principal.distributeur_vin_id ?? undefined} />
                </> : <div className="tableau">
                  <table style={{ minWidth: 640 }}>
                    <thead><tr><th>Vin</th><th className="droite">En stock</th><th className="droite">En commande</th><th className="droite">Prix d’achat HTVA</th><th className="droite">À commander</th></tr></thead>
                    <tbody>
                      {b.groupes.map(({ principal: v }) => {
                        const alerte = stockBas(v.stock, limite);
                        const nom = nomPourListe(v);
                        return (
                          <tr key={v.id} className={sp.vin === v.id ? 'choisi' : undefined}>
                            <td><div className="vin-cell"><VignetteVin url={v.etiquette_url} logo={v.logo_distributeur} taille={36} /><div><div className="nom">{nom[0]}{v.millesime ? ` ${v.millesime}` : ''}</div>{nom.length > 1 && <div className="petit">{nom.slice(1).join(' · ')}</div>}</div></div></td>
                            <td className="droite" style={{ whiteSpace: 'nowrap' }}>{alerte && <span className="alerte-stock" role="img" aria-label="Stock bas" title="Stock bas">!</span>} <b>{v.stock}</b></td>
                            <td className="droite">{v.en_commande || '—'}</td>
                            <td className="droite"><span className="champ-prix"><input type="text" inputMode="decimal" name={`achat_${v.id}`} defaultValue={achats.has(v.id) ? achats.get(v.id)!.toFixed(2).replace('.', ',') : ''} placeholder="—" aria-label={`Prix d’achat HTVA : ${v.libelle}`} /> €</span></td>
                            <td className="droite"><input type="number" name={`qte_${v.id}`} min={0} max={10000} defaultValue={sp.vin === v.id ? 6 : undefined} placeholder="0" className="champ-commande" aria-label={`Bouteilles à commander : ${v.libelle}`} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>}
                <div className="barre-valider"><button className="btn rouge" disabled={!b.id && !fournisseurs.length}>Valider la commande{b.id ? ` à ${b.nom}` : ''}</button></div>
              </FormulaireAdmin>
            </Panneau>
          );
        })}
    </ChoixCommande>
  );

  // Commande refusée par Quid Vinum depuis moins d'un jour : encore parmi les commandes ouvertes (statut et explication) ;
  // ensuite, dans les commandes réceptionnées ou annulées.
  const refuseeRecente = (c: Commande) => c.statut_qv === 'refusee' && Boolean(c.statut_qv_le) && Date.now() - new Date(c.statut_qv_le!).getTime() < 864e5;
  const enCours = [...recues.filter(refuseeRecente), ...ouvertes];
  const cloturees = recues.filter((c) => !refuseeRecente(c));

  return (
    <>
      <Entete titre="Commandes" texte="Commandez à vos distributeurs : le bon de commande est préparé, vous l’envoyez d’ici, et les bouteilles sont comptées « en commande ». À la livraison, « Bouteilles réceptionnées » les ajoute au stock.">
        <Superposition bouton="+ Nouvelle commande" titre="Nouvelle commande" classeBouton="btn rouge" large ouvert={Boolean(sp.f || sp.vin)}>
          {nouvelle}
        </Superposition>
      </Entete>
      <Message ok={sp.ok} />
      {/* Commande Quid Vinum en cours : la page se met à jour seule (statut changé par Quid Vinum, presque en temps réel). */}
      {ouvertes.some((c) => c.via_qv && c.envoyee_le) && <ActualisationAuto secondes={30} />}
      {sansCoordonnees && <p className="message">Ajoutez l’adresse et l’e-mail de votre restaurant dans <Link href={`/admin/${resto}/parametres`}>Paramètres du restaurant</Link> : ils figurent sur vos bons de commande.</p>}

      <section className="pile">
        <h2>Commandes ouvertes <span className="discret" style={{ fontWeight: 500 }}>{enCours.length}</span></h2>
        {enCours.length ? <div className="pile" style={{ gap: 12 }}>{enCours.map(carte)}</div>
          : <p className="discret" style={{ margin: 0 }}>Aucune commande en cours.</p>}
      </section>

      {cloturees.length > 0 && (
        <details className="pile">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Commandes réceptionnées ou annulées ({cloturees.length})</summary>
          <div className="pile" style={{ gap: 12, marginTop: 12 }}>{cloturees.map(carte)}</div>
        </details>
      )}
    </>
  );
}
