import Link from 'next/link';
import { changerModeTest, testerEmail, voirCommeRestaurant } from './actions';
import { modeTestDistributeurs } from '@/lib/admin/stocks';
import { CopierLien } from '@/components/admin/CopierLien';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { indicateurs, restaurantsSuper } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';
import { etatClaude, modeleAccords, modeleLecture } from '@/lib/claude';
import { etatEmail } from '@/lib/email';

const STATUTS: Record<string, [string, 'ok' | 'propose' | 'defaut']> = {
  mise_en_place: ['Mise en place', 'propose'], en_service: ['En service', 'ok'], suspendu: ['Suspendu', 'defaut'],
};

export default async function Restaurants({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string; lien?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [ind, restos, modeTest] = await Promise.all([indicateurs(), restaurantsSuper(), modeTestDistributeurs()]);

  return (
    <>
      <Entete titre="Restaurants" texte="Tous les restaurants : cliquez sur une carte pour ouvrir ses réglages.">
        <Link href="/admin/super/restaurants/nouveau" className="btn rouge">+ Ajouter un restaurant</Link>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      {sp.lien && <div className="carte-bo" style={{ padding: '14px 20px' }}><CopierLien url={sp.lien} titre="Lien pour choisir son mot de passe" /></div>}
      {(() => {
        // Branchement de Claude : appels directs chez Anthropic (facturés sur le compte Anthropic), jamais par la passerelle Netlify.
        const c = etatClaude();
        const ok = c.cle === 'clé du compte Anthropic';
        return (
          <p className="petit" style={{ margin: 0, color: ok ? 'var(--vert)' : 'var(--ocre)' }}>
            Claude : {ok ? 'appels directs à Anthropic, avec la clé du compte Anthropic.' : `${c.cle} : les appels à Claude vont échouer tant que ANTHROPIC_API_KEY n’est pas une clé sk-ant- du compte Anthropic.`}
            {c.passerelleNetlify && ' La passerelle IA de Netlify est active sur le site, mais l’app ne l’utilise plus.'}
            {` Modèles : ${modeleAccords()} pour les accords, commentaires, présentations et la discussion ; ${modeleLecture()} pour lire les cartes et menus.`}
          </p>
        );
      })()}
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
      <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{ind.restaurants}</div><span className="discret">restaurants</span></div>
        <Link href="/admin/super/producteurs" className="carte-bo" style={{ padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
          <div className="chiffre">{ind.producteurs}</div><span className="discret">producteurs à valider</span></Link>
        <Link href="/admin/super/regles" className="carte-bo" style={{ padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
          <div className="chiffre">{ind.regles ?? 'V7'}</div><span className="discret">règles en service{ind.regles_brouillon ? ` · brouillon ${ind.regles_brouillon}` : ''}</span></Link>
        <Link href="/admin/super/principes" className="carte-bo" style={{ padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
          <div className="chiffre">{ind.principes ?? '—'}</div><span className="discret">principes en service{ind.brouillon ? ` · brouillon ${ind.brouillon}` : ''}</span></Link>
      </div>

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

    </>
  );
}
