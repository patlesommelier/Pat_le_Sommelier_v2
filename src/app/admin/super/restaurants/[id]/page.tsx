// Page d'un restaurant (super-admin, en cliquant sur sa carte) : tous ses réglages de super-admin — statut, mise en place,
// carte et accords (préparation), producteurs à valider, distributeurs (et verrou sur un seul distributeur Quid Vinum), suppression.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { changerStatutRestaurant, envoyerCarteComplete, relancerPreparation, supprimerRestaurant, verrouillerDistributeurQv, voirCommeRestaurant } from '../../actions';
import { BoutonConfirmation } from '@/components/admin/BoutonConfirmation';
import { CopierLien } from '@/components/admin/CopierLien';
import { etapesRestaurant } from '../../../[resto]/etapes';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { restaurantsSuper } from '@/lib/super/donnees';
import { adresseApp } from '@/lib/admin/qr';
import { FormulaireVerrou } from '@/components/admin/FormulaireVerrou';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { getFournisseurs } from '@/lib/admin/stocks';
import { vinsSurCarteParDistributeur } from '@/lib/distributeurs/donnees';
import { requete } from '@/lib/db';

const STATUTS: Record<string, [string, 'ok' | 'propose' | 'defaut']> = {
  mise_en_place: ['Mise en place', 'propose'], en_service: ['En service', 'ok'], suspendu: ['Suspendu', 'defaut'],
};

export default async function ConfigurationRestaurant({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string; lien?: string }> }) {
  await exigerAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [r] = await requete<{ id: string; nom: string; ville: string | null; statut: string; distributeur_qv_unique: string | null }>(
    'select id, nom, ville, statut, distributeur_qv_unique from restaurant where id = $1', [id]);
  if (!r) notFound();
  const [fournisseurs, surCarte, distributeurs] = await Promise.all([getFournisseurs(id), vinsSurCarteParDistributeur(id),
    requete<{ id: string; nom: string; actif: boolean; catalogue: number }>(
      `select d.id, d.nom, d.actif, (select count(*)::int from distributeur_vin v where v.distributeur_id = d.id and v.actif) as catalogue
         from distributeur d order by d.actif desc, lower(d.nom)`)]);
  const propres = fournisseurs.filter((f) => !f.distributeur_id);
  const choisi = (d: string) => fournisseurs.find((f) => f.distributeur_id === d) ?? null;
  const verrou = distributeurs.find((d) => d.id === r.distributeur_qv_unique) ?? null;
  // Quid Vinum : ceux qu'il a sélectionnés d'abord, puis ceux qui lui sont proposés ; les distributeurs masqués seulement s'il les avait choisis.
  const qv = distributeurs.filter((d) => d.actif || choisi(d.id)).sort((a, b) => Number(Boolean(choisi(b.id))) - Number(Boolean(choisi(a.id))));
  // Mise en place (6 étapes, comme dans l'espace du restaurant) et chiffres de la carte et des accords.
  const [bo, resume, infos] = await Promise.all([getRestaurantBO(id), getResume(id), restaurantsSuper()]);
  const x = infos.find((i) => i.id === id)!;
  const etapes = bo ? etapesRestaurant(bo, resume).filter((e) => e.libelle !== 'Simulateur') : [];
  const lienApp = await adresseApp(id);
  // « La carte est complète » : étiquettes encore manquantes (vins proposés), et date du dernier envoi.
  const [complete] = await requete<{ manquent: number; envoye: string | null }>(
    `select (select count(distinct libelle)::int from vin_carte where restaurant_id = $1 and disponible and etiquette_url is null) as manquent,
            (select carte_complete_le::text from restaurant where id = $1) as envoye`, [id]);
  // Remise du restaurant chez chaque distributeur actif (la sienne, sinon celle du distributeur), sur le prix public.
  const remises = new Map((await requete<{ distributeur_id: string; remise: number; propre: boolean }>(
    `select f.distributeur_id, coalesce(f.remise, d.remise_restaurant)::float8 as remise, f.remise is not null as propre
       from fournisseur f join distributeur d on d.id = f.distributeur_id where f.restaurant_id = $1`, [id])).map((m) => [m.distributeur_id, m]));

  return (
    <>
      <Entete titre={r.nom} texte={`Réglages de super-admin du restaurant${r.ville ? ` · ${r.ville}` : ''}.`}>
        <Link href="/admin/super" className="btn fantome petit">← Restaurants</Link>
        <Link href={`/admin/${id}`} className="btn petit">Super-admin</Link>
        <form action={voirCommeRestaurant.bind(null, id)}><button className="btn sec petit">Vue restaurant</button></form>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      {/* Restaurant tout juste créé, invitation non envoyée par e-mail : le lien à transmettre au responsable. */}
      {sp.lien && <div className="carte-bo" style={{ padding: '14px 20px' }}><CopierLien url={sp.lien} titre="Lien pour choisir son mot de passe" /></div>}

      <section className="carte-bo pile">
        <h2 style={{ margin: 0 }}>Statut et mise en place</h2>
        <form action={changerStatutRestaurant.bind(null, id)} className="ligne-actions" style={{ alignItems: 'center' }}>
          <input type="hidden" name="retour" value={`/admin/super/restaurants/${id}`} />
          {/* App des clients (accords en préparation, ouverte, ou suspendue) : distinct du statut vert / jaune / rouge,
              qui se règle sur la carte du restaurant dans la liste. */}
          <span className="petit"><b>App des clients</b></span>
          <select name="statut" defaultValue={r.statut} aria-label={`Statut de ${r.nom}`} style={{ minHeight: 36, borderRadius: 8, border: '1.5px solid var(--ligne)' }}>
            {Object.entries(STATUTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn sec petit">Enregistrer</button>
          {x.origine === 'inscription' && <Etat type="propose">Inscrit en ligne</Etat>}
        </form>
        <p className="petit" style={{ margin: 0 }}><b>{etapes.filter((e) => e.etat === 'fait').length}/{etapes.length}</b> étapes faites :{' '}
          {etapes.map((e, i) => <span key={e.href}>{i ? ' · ' : ''}<Link href={e.href}>{e.libelle}</Link> {e.etat === 'fait' ? '✓' : '…'}</span>)}</p>
        <p className="petit discret" style={{ margin: 0 }}>{x.acces} accès · {x.langues.map((l) => l.toUpperCase()).join('/')}{x.ajustements ? ` · ${x.ajustements} règle(s) ajustée(s)` : ''}</p>
        <CopierLien url={lienApp} titre="Lien de l’app des clients" />
      </section>

      <section className="carte-bo pile">
        <h2 style={{ margin: 0 }}>Carte et accords</h2>
        <p style={{ margin: 0 }}><b>{x.plats}</b> plats · <b>{x.vins}</b> vins sur la carte · <b>{x.accords.toLocaleString('fr-BE')}</b> accords
          {x.a_relire ? <> · <Link href={`/admin/${id}/accords`}>{x.a_relire} à relire</Link></> : null}</p>
        {x.passe_rapide > 0 && <p className="petit" style={{ margin: 0, color: 'var(--ocre)' }}>Passe rapide : {x.passe_rapide} plat(s) aux accords écrits avec Sonnet à l’inscription — régénérer avec Opus.</p>}
        {x.prep_attente > 0 && <p className="petit" style={{ margin: 0 }}>Préparation en cours : {x.prep_faits + x.prep_erreurs}/{x.prep_total} plats.</p>}
        {x.prep_erreurs > 0 && x.prep_attente === 0 && (
          <form action={relancerPreparation.bind(null, id)} className="ligne-actions" style={{ alignItems: 'center' }}>
            <span className="petit" style={{ color: 'var(--ocre)' }}>{x.prep_erreurs} plat(s) en échec</span>
            <button className="btn sec petit">Relancer la préparation</button>
          </form>
        )}
        <p className="petit" style={{ margin: 0 }}>Producteurs à valider sur sa carte : {x.producteurs ? <Link href="/admin/super/producteurs">{x.producteurs}</Link> : 'aucun'}.</p>
        {/* Carte relue et étiquettes toutes là : on l'annonce au restaurant (post-it à sa prochaine visite). */}
        <form action={envoyerCarteComplete.bind(null, id)} className="ligne-actions" style={{ alignItems: 'center', borderTop: '1px solid var(--ligne)', paddingTop: 12 }}>
          <button className="btn petit" disabled={complete.manquent > 0}>Envoyer « La carte est complète »</button>
          <span className="petit" style={{ color: complete.manquent ? 'var(--ocre)' : 'var(--discret)' }}>
            {complete.manquent
              ? <>Encore <Link href={`/admin/${id}/carte`}>{complete.manquent} étiquette{complete.manquent > 1 ? 's' : ''} à trouver</Link> avant de pouvoir l’envoyer.</>
              : complete.envoye ? `Déjà envoyé le ${new Date(complete.envoye).toLocaleDateString('fr-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'long' })} : vous pouvez le renvoyer.`
              : 'Toutes les étiquettes sont là : le restaurant verra un post-it à sa prochaine visite.'}
          </span>
        </form>
      </section>

      <section className="carte-bo pile">
        <div><h2 style={{ margin: 0 }}>Distributeur Quid Vinum unique</h2>
          <p className="sous" style={{ margin: '4px 0 0' }}>Verrouillé, le restaurant ne voit, ne cherche et ne commande que dans le catalogue de ce distributeur Quid Vinum.
            Ses propres distributeurs ne changent pas.</p></div>
        <p style={{ margin: 0 }}>{verrou ? <>Verrouillé sur <b>{verrou.nom}</b>.</> : 'Pas de verrou : tous les distributeurs Quid Vinum lui sont proposés.'}</p>
        <FormulaireVerrou action={verrouillerDistributeurQv.bind(null, id)} actuel={r.distributeur_qv_unique} restaurant={r.nom}
          distributeurs={distributeurs.filter((d) => d.actif).map((d) => ({ id: d.id, nom: d.nom, actif: Boolean(choisi(d.id)) }))} />
      </section>

      <section className="carte-bo pile">
        <h2 style={{ margin: 0 }}>Distributeurs Quid Vinum</h2>
        <div className="tableau">
          <table className="tableau-super">
            <thead><tr><th>Distributeur</th><th>Chez ce restaurant</th><th>Remise</th><th style={{ textAlign: 'right' }}>Vins sur la carte</th><th style={{ textAlign: 'right' }}>Catalogue</th></tr></thead>
            <tbody>
              {qv.map((d) => {
                const f = choisi(d.id);
                const bloque = Boolean(verrou && verrou.id !== d.id);
                return (
                  <tr key={d.id}>
                    <td><Link href={`/admin/super/distributeurs/${d.id}`}><b>{d.nom}</b></Link>{!d.actif && <> <Etat type="defaut">Masqué</Etat></>}</td>
                    <td>{bloque ? <Etat type="defaut">Exclu par le verrou</Etat> : f ? <Etat type="ok">Actif</Etat> : <span className="discret">Non sélectionné</span>}
                      {verrou?.id === d.id && <> <Etat type="propose">Unique</Etat></>}</td>
                    <td>{f && remises.get(d.id) ? `${String(remises.get(d.id)!.remise).replace('.', ',')} %${remises.get(d.id)!.propre ? '' : ' (par défaut)'}` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{surCarte.get(d.id) ?? 0}</td>
                    <td style={{ textAlign: 'right' }} className="discret">{d.catalogue} vins</td>
                  </tr>
                );
              })}
              {!qv.length && <tr><td colSpan={5} className="discret">Aucun distributeur Quid Vinum pour le moment.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="petit discret" style={{ margin: 0 }}>La marge de ce restaurant se règle dans la fiche du distributeur, partie « Restaurants et marges ».</p>
      </section>

      <section className="carte-bo pile">
        <h2 style={{ margin: 0 }}>Distributeurs du restaurant</h2>
        <p className="sous" style={{ margin: 0 }}>Ceux qu’il a ajoutés lui-même : ses bons de commande leur sont envoyés directement.</p>
        {propres.length ? (
          <div className="tableau">
            <table className="tableau-super">
              <thead><tr><th>Distributeur</th><th>E-mail</th><th>Téléphone</th><th style={{ textAlign: 'right' }}>Vins sur la carte</th></tr></thead>
              <tbody>{propres.map((f) => (
                <tr key={f.id}><td><b>{f.nom}</b>{f.contact && <div className="petit discret">{f.contact}</div>}</td><td>{f.email ?? '—'}</td><td>{f.telephone ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{f.vins}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="discret" style={{ margin: 0 }}>Aucun distributeur à lui.</p>}
      </section>

      <section className="carte-bo pile" style={{ borderColor: 'var(--rouge)' }}>
        <h2 style={{ margin: 0 }}>Supprimer ce restaurant</h2>
        <p className="petit discret" style={{ margin: 0 }}>Menu, carte des vins, accords, règles et accès sont effacés. Irréversible.</p>
        <span><BoutonConfirmation action={supprimerRestaurant.bind(null, id)} libelle="Supprimer" className="btn fantome petit" saisie={r.nom}
          question={`Supprimer définitivement « ${r.nom} » ? Menu, carte des vins, accords, règles et accès seront effacés. Cette action est irréversible.`} /></span>
      </section>
    </>
  );
}
