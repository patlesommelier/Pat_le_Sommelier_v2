// Gestion des stocks — Commandes de vin : les commandes ouvertes (bon de commande PDF, envoi au fournisseur, réception),
// puis une nouvelle commande, les vins groupés par fournisseur avec leur stock actuel.
import Link from 'next/link';
import { annulerCommande, creerCommande, envoyerCommande, marquerEnvoyee, receptionnerCommande } from '../../stocks-actions';
import { EnvoiCommande } from '@/components/admin/EnvoiCommande';
import { CatalogueCommande, type LigneCatalogue } from '@/components/admin/CatalogueCommande';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { Entete, Etat, Vignette } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { getCommandes, getCoordonnees, getFournisseurs, getPrixAchat, stockBas, type Commande } from '@/lib/admin/stocks';
import { euros, referenceCommande } from '@/lib/bon-commande';
import { envoiEmailConfigure } from '@/lib/email';
import { catalogueDistributeur } from '@/lib/distributeurs/donnees';
import { vinDeLaCarte } from '@/lib/distributeurs/tarif';
import { nomPourListe, regrouperVins } from '../carte/etats';

const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' });
const total = (c: Commande) => c.lignes.reduce((n, l) => n + l.quantite, 0);

export default async function Commandes({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ commande?: string; f?: string; vin?: string }> }) {
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
    const lignes: LigneCatalogue[] = (await catalogueDistributeur(f.distributeur_id!)).map((c) => {
      const surCarte = groupes.find((g) => g.principal.distributeur_vin_id === c.id)?.principal
        ?? groupes.find((g) => g.principal.id === vinDeLaCarte(c, carteSimple)?.id)?.principal;
      return { id: c.id, section: c.section, producteur: c.producteur, libelle: c.libelle, millesime: c.millesime, contenance: c.contenance, prix: c.prix,
        epuise: c.epuise, maximum: c.maximum, surCarte: surCarte ? { stock: surCarte.stock, enCommande: surCarte.en_commande, bas: stockBas(surCarte.stock, limite) } : null };
    });
    return [f.id, lignes] as const;
  })));
  const blocs = [
    ...fournisseurs.map((f) => ({ id: f.id, nom: f.nom, email: f.email, groupes: groupes.filter((g) => g.principal.fournisseur_id === f.id), catalogue: catalogues.get(f.id) }))
      .filter((b) => b.groupes.length || b.catalogue?.length),
    { id: '', nom: 'Vins sans fournisseur', email: null, catalogue: undefined, groupes: groupes.filter((g) => !g.principal.fournisseur_id || !fournisseurs.some((f) => f.id === g.principal.fournisseur_id)) },
  ].filter((b) => b.groupes.length || b.catalogue?.length);
  const cible = sp.f === 'aucun' ? '' : sp.f;
  const sansCoordonnees = !coord?.commande_email || !coord.commande_adresse;

  const carte = (c: Commande) => {
    const ref = referenceCommande({ numero: c.numero, date: new Date(c.cree_le) });
    const nomResto = coord?.commande_societe || coord?.nom || '';
    const sujet = `Bon de commande ${ref} — ${nomResto}${c.via_qv ? ` — ${c.fournisseur_nom}` : ''}`;
    const corps = `Bonjour,\n\nVeuillez trouver ci-joint notre bon de commande n° ${ref} (${total(c)} bouteille${total(c) > 1 ? 's' : ''}) :\n\n${c.lignes.map((l) => `- ${l.quantite} × ${l.libelle}${l.prix_achat != null ? ` à ${euros(l.prix_achat)} HTVA` : ''}`).join('\n')}\n\nMerci de nous confirmer la commande et la date de livraison.\n\n${nomResto}`;
    const envoyee = Boolean(c.envoyee_le);
    return (
      <article key={c.id} id={`commande-${c.id}`} className={`carte-bo pile commande${sp.commande === c.id ? ' choisie' : ''}`} style={{ gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="pile" style={{ gap: 2 }}>
            <span className="surtitre">Commande n° {ref} · {date(c.cree_le)}</span>
            <b style={{ fontSize: 18 }}>{c.fournisseur_nom}</b>
          </span>
          {/* Statut : à envoyer → commande envoyée → bouteilles réceptionnées (ou annulée). */}
          {c.statut === 'ouverte'
            ? (envoyee ? <Etat type="propose">Commande envoyée le {date(c.envoyee_le!)}</Etat> : <Etat type="attention">À envoyer</Etat>)
            : c.statut === 'recue' ? <Etat type="ok">Bouteilles réceptionnées le {date(c.recue_le!)}</Etat> : <Etat type="defaut">Annulée</Etat>}
        </div>
        <ul className="lignes-commande">
          {c.lignes.map((l, i) => <li key={i}><b>{l.quantite}</b><span>{l.libelle}{l.detail && <small> · {l.detail}</small>}</span>{l.prix_achat != null && <span className="prix-ligne">{euros(l.prix_achat)} <small>× {l.quantite} =</small> <b>{euros(l.prix_achat * l.quantite)}</b></span>}</li>)}
        </ul>
        <span className="petit discret">{total(c)} bouteille{total(c) > 1 ? 's' : ''}{c.lignes.some((l) => l.prix_achat != null) && <> · <b style={{ color: 'var(--encre)' }}>Total {euros(c.lignes.reduce((n, l) => n + (l.prix_achat ?? 0) * l.quantite, 0))} HTVA</b></>}</span>
        {c.statut === 'ouverte' && (
          <div className="ligne-actions" style={{ alignItems: 'flex-start' }}>
            {c.fournisseur_email && (
              <EnvoiCommande pdf={`/admin/${resto}/commandes/${c.id}/pdf`} fichier={`bon-de-commande-${ref}.pdf`} email={c.fournisseur_email} sujet={sujet} corps={corps}
                serveur={emailPret} envoyer={envoyerCommande.bind(null, resto, c.id)} marquer={marquerEnvoyee.bind(null, resto, c.id)} deja={envoyee} />
            )}
            <FormulaireAdmin action={receptionnerCommande.bind(null, resto, c.id)}>
              <button className={envoyee ? 'btn' : 'btn sec'} title="Les bouteilles de cette commande sont ajoutées au stock">Bouteilles réceptionnées</button>
            </FormulaireAdmin>
            <a href={`/admin/${resto}/commandes/${c.id}/pdf`} target="_blank" rel="noopener" className="btn sec">Voir le PDF</a>
            <BoutonSupprimer action={annulerCommande.bind(null, resto, c.id)} libelle="Annuler" enCoursLibelle="Annulation…" className="btn fantome petit"
              question={`Annuler la commande à ${c.fournisseur_nom} ? Ses bouteilles ne seront plus comptées « en commande ».`} />
          </div>
        )}
        {c.statut === 'ouverte' && c.via_qv && <span className="petit discret">Commande via Quid Vinum{c.fournisseur_email ? ` : le bon part à ${c.fournisseur_email}` : ' : l’adresse des commandes de Quid Vinum n’est pas encore renseignée, contactez Quid Vinum.'}</span>}
        {c.statut === 'ouverte' && !c.via_qv && !c.fournisseur_email && <span className="petit" style={{ color: 'var(--ocre)' }}>Pour envoyer le bon de commande, ajoutez l’adresse e-mail du fournisseur dans <Link href={`/admin/${resto}/fournisseurs`}>Fournisseurs</Link>.</span>}
      </article>
    );
  };

  return (
    <>
      <Entete titre="Commandes de vin" texte="Commandez à vos fournisseurs : Pat prépare le bon de commande, vous l’envoyez d’ici, et les bouteilles sont comptées « en commande ». À la livraison, « Bouteilles réceptionnées » les ajoute au stock.">
        <a href="#nouvelle" className="btn rouge">+ Faire une commande</a>
      </Entete>
      {sansCoordonnees && <p className="message">Ajoutez l’adresse et l’e-mail de votre restaurant dans <Link href={`/admin/${resto}/parametres`}>Paramètres</Link> : ils figurent sur vos bons de commande.</p>}

      <section className="pile">
        <h2>Commandes ouvertes <span className="discret" style={{ fontWeight: 500 }}>{ouvertes.length}</span></h2>
        {ouvertes.length ? <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))' }}>{ouvertes.map(carte)}</div>
          : <p className="discret" style={{ margin: 0 }}>Aucune commande en cours.</p>}
      </section>

      <section className="pile" id="nouvelle">
        <div><h2>Nouvelle commande</h2><p className="discret" style={{ margin: '6px 0 0' }}>Les vins sont groupés par fournisseur. Le prix d’achat HTVA se corrige ici si le fournisseur l’a changé. Indiquez les bouteilles à commander, puis validez : le bon de commande est prêt à envoyer.</p></div>
        {!blocs.length && <p className="discret">Aucun vin disponible sur la carte.</p>}
        {blocs.map((b) => {
          const basN = b.catalogue ? b.catalogue.filter((l) => l.surCarte?.bas).length : b.groupes.filter((g) => stockBas(g.principal.stock, limite)).length;
          return (
            <details key={b.id || 'aucun'} className="carte-bo bloc-fournisseur" open={cible !== undefined ? cible === b.id : basN > 0}>
              <summary>
                <span><b style={{ fontSize: 17 }}>{b.nom}</b>{b.catalogue ? <> <Etat type="ok">Quid Vinum</Etat> <span className="discret">· catalogue de {b.catalogue.length} vin{b.catalogue.length > 1 ? 's' : ''}</span></>
                  : <span className="discret"> · {b.groupes.length} vin{b.groupes.length > 1 ? 's' : ''}</span>}</span>
                {basN > 0 && <span className="alerte-texte"><span className="alerte-stock" aria-hidden="true">!</span>{basN} en stock bas</span>}
              </summary>
              <FormulaireAdmin action={creerCommande.bind(null, resto, b.id)} className="pile" style={{ gap: 12, marginTop: 12 }}>
                {!b.id && (fournisseurs.length
                  ? <label className="champ" style={{ maxWidth: 360 }}><span>Fournisseur de cette commande</span>
                      <select name="fournisseur" defaultValue="" required><option value="" disabled>Choisir…</option>{fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}</select></label>
                  : <p className="petit" style={{ color: 'var(--ocre)', margin: 0 }}>Ajoutez d’abord vos fournisseurs dans <Link href={`/admin/${resto}/fournisseurs`}>Fournisseurs</Link>, puis choisissez celui de chaque vin dans Stocks.</p>)}
                {b.catalogue ? <>
                  <p className="petit discret" style={{ margin: 0 }}>Prix proposés par Quid Vinum (HTVA). Votre commande part chez Quid Vinum, qui la transmet à {b.nom}.</p>
                  <CatalogueCommande lignes={b.catalogue} />
                </> : <div className="tableau">
                  <table style={{ minWidth: 640 }}>
                    <thead><tr><th>Vin</th><th className="droite">En stock</th><th className="droite">En commande</th><th className="droite">Prix d’achat HTVA</th><th className="droite">À commander</th></tr></thead>
                    <tbody>
                      {b.groupes.map(({ principal: v }) => {
                        const alerte = stockBas(v.stock, limite);
                        const nom = nomPourListe(v);
                        return (
                          <tr key={v.id} className={sp.vin === v.id ? 'choisi' : undefined}>
                            <td><div className="vin-cell"><Vignette url={v.etiquette_url} taille={36} /><div><div className="nom">{nom[0]}{v.millesime ? ` ${v.millesime}` : ''}</div>{nom.length > 1 && <div className="petit">{nom.slice(1).join(' · ')}</div>}</div></div></td>
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
                <span><button className="btn rouge" disabled={!b.id && !fournisseurs.length}>Valider la commande{b.id ? ` à ${b.nom}` : ''}</button></span>
              </FormulaireAdmin>
            </details>
          );
        })}
      </section>

      {recues.length > 0 && (
        <details className="pile">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Commandes réceptionnées ou annulées ({recues.length})</summary>
          <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', marginTop: 12 }}>{recues.map(carte)}</div>
        </details>
      )}
    </>
  );
}
