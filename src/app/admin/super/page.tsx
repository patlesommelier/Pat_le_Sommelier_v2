import Link from 'next/link';
import { changerModeTest, testerEmail, voirCommeRestaurant } from './actions';
import { modeTestDistributeurs } from '@/lib/admin/stocks';
import { etatEmail } from '@/lib/email';
import { CopierLien } from '@/components/admin/CopierLien';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { restaurantsSuper } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';

const STATUTS: Record<string, [string, 'ok' | 'propose' | 'defaut']> = {
  mise_en_place: ['Mise en place', 'propose'], en_service: ['En service', 'ok'], suspendu: ['Suspendu', 'defaut'],
};

export default async function Restaurants({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string; lien?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [restos, modeTest, echecs] = await Promise.all([restaurantsSuper(), modeTestDistributeurs(),
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
                  {/* En service : un simple rond vert ; les autres statuts restent écrits. */}
                  {r.statut === 'en_service' && <span className="rond-vert" role="img" aria-label="En service" title="En service" />}
                </span>
                <span className="petit discret">{[r.ville, r.langues.map((l) => l.toUpperCase()).join('/')].filter(Boolean).join(' · ') || ' '}</span>
                {(r.statut !== 'en_service' || r.origine === 'inscription') && (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {r.statut !== 'en_service' && <Etat type={STATUTS[r.statut]?.[1] ?? ''}>{STATUTS[r.statut]?.[0] ?? r.statut}</Etat>}
                    {r.origine === 'inscription' && <Etat type="propose">Inscription</Etat>}
                  </span>
                )}
                <div className="carte-resto-actions">
                  <Link href={`/admin/${r.id}`} className="btn mini" title="Votre espace de super-admin pour ce restaurant : rankings, Wine Labs, cuisine interne">Super-admin</Link>
                  <form action={voirCommeRestaurant.bind(null, r.id)}><button className="btn sec mini" title={`Voir l’espace exactement comme ${r.nom} le voit, sans vos outils de super-admin`}>Vue restaurant</button></form>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Tout en bas : envoi des e-mails (test) et mode test des commandes. */}
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
      {/* Mode test : pas d'e-mail aux distributeurs des restaurants (bons de commande, annulations). */}
      <form action={changerModeTest} className="ligne-actions" style={{ alignItems: 'center' }}>
        <label className="petit" style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, color: modeTest ? 'var(--ocre)' : undefined }}>
          <input type="checkbox" name="mode_test" defaultChecked={modeTest} /> Mode test : ne rien envoyer aux distributeurs</label>
        <button className="btn fantome petit">Enregistrer</button>
        <span className="petit discret">{modeTest ? 'Les bons de commande et les annulations ne partent pas chez les distributeurs des restaurants (Quid Vinum reçoit les siennes).' : 'Les bons de commande partent chez les distributeurs.'}</span>
      </form>
      </div>
    </>
  );
}
