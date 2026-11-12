import Link from 'next/link';
import { testerEmail, voirCommeRestaurant } from './actions';
import { etatEmail } from '@/lib/email';
import { BoutonMode } from '@/components/admin/BoutonMode';
import { CopierLien } from '@/components/admin/CopierLien';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { restaurantsSuper, suiviMiseEnRoute } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

const STATUTS: Record<string, [string, 'ok' | 'propose' | 'defaut']> = {
  mise_en_place: ['Mise en place', 'propose'], en_service: ['En service', 'ok'], suspendu: ['Suspendu', 'defaut'],
};

export default async function Restaurants({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string; lien?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [restos, suivi, echecs] = await Promise.all([restaurantsSuper(), suiviMiseEnRoute(),
    // Dernières lectures de carte ou de menu en échec à l'inscription (7 jours), avec le détail technique.
    requete<{ email: string | null; quand: string; quoi: string; message: string; detail: string | null }>(
      `select i.email, i.maj_le::text as quand, t.quoi, i.lecture->t.quoi->>'message' as message, i.lecture->t.quoi->>'detail' as detail
         from inscription i cross join (values ('carte'), ('menu')) as t(quoi)
        where i.lecture->t.quoi->>'statut' = 'erreur' and i.maj_le > now() - interval '7 days'
        order by i.maj_le desc limit 5`)]);

  return (
    <>
      <Entete titre="Restaurants">
        <Link href="/admin/super/restaurants/nouveau" className="btn rouge">+ Ajouter un restaurant</Link>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      {sp.lien && <div className="carte-bo" style={{ padding: '14px 20px' }}><CopierLien url={sp.lien} titre="Lien pour choisir son mot de passe" /></div>}
      {/* Une carte par restaurant : logo sur sa couleur, statut, accès à son espace. La carte ouvre ses réglages de super-admin. */}
      <div className="grille-restos">
        {restos.map((r) => {
          const logo = r.logo_fonce_url || r.logo_url;
          return (
            <article key={r.id} className="carte-resto carte-bo">
              <div className="carte-resto-tete" style={{ background: r.couleur }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo ? <img src={logo} alt="" /> : <span className="initiale">{r.nom.slice(0, 1)}</span>}
              </div>
              <div className="carte-resto-corps">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link href={`/admin/super/restaurants/${r.id}`} className="lien-carte"><b>{r.nom}</b></Link>
                  {/* Statut de l'espace : petit rond vert (actif), jaune (inscription) ou rouge (test) ; un clic pour le changer. */}
                  <BoutonMode id={r.id} nom={r.nom} mode={r.mode} retour="/admin/super" />
                </span>
                <span className="petit discret">{[r.ville, r.langues.map((l) => l.toUpperCase()).join('/')].filter(Boolean).join(' · ') || ' '}</span>
                {r.statut !== 'en_service' && (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Etat type={STATUTS[r.statut]?.[1] ?? ''}>{STATUTS[r.statut]?.[0] ?? r.statut}</Etat>
                  </span>
                )}
                <div className="carte-resto-actions">
                  <Link href={`/admin/${r.id}/stocks`} className="btn mini" title="Votre espace de super-admin pour ce restaurant : rankings, Wine Labs, cuisine interne">Super-admin</Link>
                  <form action={voirCommeRestaurant.bind(null, r.id)}><button className="btn sec mini" title={`Voir l’espace exactement comme ${r.nom} le voit, sans vos outils de super-admin`}>Vue restaurant</button></form>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Mise en route des restaurants inscrits seuls (60 jours) : où ils s'arrêtent, et en combien de temps arrive le premier client. */}
      {suivi.chiffres.commencees + suivi.chiffres.comptes > 0 && (() => {
        const c = suivi.chiffres;
        const etapes: [number, string][] = [[c.commencees, 'inscriptions commencées'], [c.comptes, 'comptes créés'], [c.ouvertes, 'apps ouvertes aux clients'], [c.clients, 'avec un premier client']];
        const delai = (h: number) => h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} jours`;
        const date = (d: string) => new Date(d).toLocaleDateString('fr-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short' });
        return (
          <section className="carte-bo pile" style={{ gap: 16, marginTop: 32 }} aria-labelledby="suivi-mise-en-route">
            <div className="pile" style={{ gap: 4 }}>
              <h2 id="suivi-mise-en-route" style={{ fontSize: 22 }}>Mise en route des inscriptions</h2>
              <span className="discret petit">Restaurants inscrits seuls ces 60 derniers jours.{c.delai_median_h !== null && ` Délai médian entre l’inscription et le premier client : ${delai(c.delai_median_h)}.`}</span>
            </div>
            <div className="entonnoir">
              {etapes.map(([n, libelle], i) => (
                <div key={libelle} className="entonnoir-pas">
                  <b className="chiffre" style={{ fontSize: 30 }}>{n}</b><span className="petit">{libelle}</span>
                  {i > 0 && etapes[i - 1][0] > 0 && <span className="petit discret">{Math.round((n / etapes[i - 1][0]) * 100)} % de l’étape d’avant</span>}
                </div>
              ))}
            </div>
            {suivi.restos.length > 0 && (
              <div className="tableau"><table>
                <thead><tr><th>Restaurant</th><th>Inscrit le</th><th>App</th><th>Premier client</th><th>Relances</th></tr></thead>
                <tbody>
                  {suivi.restos.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/admin/super/restaurants/${r.id}`}>{r.nom}</Link></td>
                      <td>{date(r.cree_le)}</td>
                      <td><Etat type={STATUTS[r.statut]?.[1] ?? ''}>{STATUTS[r.statut]?.[0] ?? r.statut}</Etat></td>
                      <td>{r.premier_client_le ? `${date(r.premier_client_le)} (après ${delai((Date.parse(r.premier_client_le) - Date.parse(r.cree_le)) / 36e5)})` : <span className="discret">pas encore</span>}</td>
                      <td>{r.relances ? `${r.relances} e-mail${r.relances > 1 ? 's' : ''}` : <span className="discret">aucune</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </section>
        );
      })()}

      {/* Tout en bas : envoi des e-mails (test). */}
      <div className="pile" style={{ gap: 8, marginTop: 64, paddingTop: 16, borderTop: '1px solid var(--ligne)' }}>
      {echecs.length > 0 && (
        <details className="petit">
          <summary style={{ cursor: 'pointer', color: 'var(--ocre)', fontWeight: 700 }}>Inscriptions : {echecs.length} lecture{echecs.length > 1 ? 's' : ''} en échec ces 7 derniers jours</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {echecs.map((x, n) => <li key={n}>{new Date(x.quand).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}{x.quoi === 'carte' ? 'carte des vins' : 'menu'}{x.email ? ` · ${x.email}` : ''} — {x.message}{x.detail ? <span className="discret"> (détail : {x.detail})</span> : null}</li>)}
          </ul>
        </details>
      )}
      {(() => {
        // Envoi d'e-mails (invitations, mot de passe oublié, bons de commande) : réglage et test.
        const e = etatEmail();
        const pret = e.cle && e.expediteur;
        return (
          <form action={testerEmail} className="ligne-actions" style={{ alignItems: 'center' }}>
            <span className="petit" style={{ color: pret ? 'var(--vert)' : 'var(--ocre)' }}>
              E-mails : {pret ? `envoyés par Resend, depuis ${e.expediteur}.` : `non configurés (${!e.cle ? 'RESEND_API_KEY manque' : 'EMAIL_EXPEDITEUR manque'}).`}
              {e.cle && !e.cleForme && ' Attention : RESEND_API_KEY n’a pas la forme d’une clé Resend (elle commence par re_) : recopiez-la depuis Resend.'}
            </span>
            <button className="btn fantome petit">Tester l’envoi d’e-mails</button>
          </form>
        );
      })()}
      </div>
    </>
  );
}
