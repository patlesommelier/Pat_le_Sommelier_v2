import Link from 'next/link';
import { changerStatutRestaurant, creerRestaurant, relancerPreparation, supprimerRestaurant, voirCommeRestaurant } from './actions';
import { BoutonConfirmation } from '@/components/admin/BoutonConfirmation';
import { etapesRestaurant } from '../[resto]/etapes';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { indicateurs, restaurantsSuper } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';
import { etatClaude, modeleAccords, modeleLecture } from '@/lib/claude';

const STATUTS: Record<string, [string, 'ok' | 'propose' | 'defaut']> = {
  mise_en_place: ['Mise en place', 'propose'], en_service: ['En service', 'ok'], suspendu: ['Suspendu', 'defaut'],
};

export default async function Restaurants({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [ind, restos] = await Promise.all([indicateurs(), restaurantsSuper()]);
  // Avancement sur les 6 étapes de la mise en place, calculé comme dans l'espace du restaurant.
  const avancement = new Map(await Promise.all(restos.map(async (r) => {
    const [bo, resume] = await Promise.all([getRestaurantBO(r.id), getResume(r.id)]);
    const etapes = bo ? etapesRestaurant(bo, resume).filter((e) => e.libelle !== 'Simulateur') : []; // le simulateur est un outil, pas une étape
    return [r.id, `${etapes.filter((e) => e.etat === 'fait').length}/${etapes.length}`] as const;
  })));

  return (
    <>
      <Entete titre="Restaurants" texte="Tous les restaurants de Pat, leur mise en place et ce qui attend votre validation." />
      <Message ok={sp.ok} erreur={sp.erreur} />
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
      <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{ind.restaurants}</div><span className="discret">restaurants</span></div>
        <Link href="/admin/super/producteurs" className="carte-bo" style={{ padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
          <div className="chiffre">{ind.producteurs}</div><span className="discret">producteurs à valider</span></Link>
        <Link href="/admin/super/regles" className="carte-bo" style={{ padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
          <div className="chiffre">{ind.regles ?? 'V7'}</div><span className="discret">règles en service{ind.regles_brouillon ? ` · brouillon ${ind.regles_brouillon}` : ''}</span></Link>
        <Link href="/admin/super/principes" className="carte-bo" style={{ padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}>
          <div className="chiffre">{ind.principes ?? '—'}</div><span className="discret">principes en service{ind.brouillon ? ` · brouillon ${ind.brouillon}` : ''}</span></Link>
      </div>

      <div className="tableau">
        <table style={{ minWidth: 820 }} className="tableau-super">
          <thead><tr><th>Restaurant</th><th>Statut</th><th>Mise en place</th><th>Menu et carte</th><th>Accords</th><th>Producteurs à valider</th></tr></thead>
          <tbody>
            {restos.map((r) => (
              <tr key={r.id}>
                <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: r.couleur, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{r.nom.slice(0, 1)}</span>
                  <div><b>{r.nom}</b>{r.origine === 'inscription' && <> <Etat type="propose">Inscription</Etat></>}<div className="petit discret">{[r.ville, r.langues.map((l) => l.toUpperCase()).join('/'), `${r.acces} accès`].filter(Boolean).join(' · ')}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                      <Link href={`/admin/${r.id}`} className="btn mini" title="Votre espace de super-admin pour ce restaurant : rankings, Wine Labs, cuisine interne">Super-admin</Link>
                      <form action={voirCommeRestaurant.bind(null, r.id)}><button className="btn sec mini" title={`Voir l’espace exactement comme ${r.nom} le voit, sans vos outils de super-admin`}>Vue restaurant</button></form>
                      <BoutonConfirmation action={supprimerRestaurant.bind(null, r.id)} libelle="Supprimer" className="btn fantome mini" saisie={r.nom}
                        question={`Supprimer définitivement « ${r.nom} » ? Menu, carte des vins, accords, règles et accès seront effacés. Cette action est irréversible.`} />
                    </div></div></div></td>
                <td>
                  <form action={changerStatutRestaurant.bind(null, r.id)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Etat type={STATUTS[r.statut]?.[1] ?? ''}>{STATUTS[r.statut]?.[0] ?? r.statut}</Etat>
                    <select name="statut" defaultValue={r.statut} aria-label={`Statut de ${r.nom}`} style={{ minHeight: 32, borderRadius: 8, border: '1.5px solid var(--ligne)' }}>
                      {Object.entries(STATUTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <button className="btn fantome petit">OK</button>
                  </form>
                </td>
                <td><b>{avancement.get(r.id)}</b> <span className="petit discret">étapes</span>{r.ajustements ? <div className="petit discret">{r.ajustements} règle(s) ajustée(s)</div> : null}</td>
                <td>{r.plats} plats · {r.vins} vins</td>
                <td>{r.accords.toLocaleString('fr-BE')}{r.a_relire ? <div className="petit discret">{r.a_relire} à relire</div> : null}
                  {r.passe_rapide > 0 && <div className="petit" style={{ color: 'var(--ocre)' }} title="Accords de l’inscription, écrits avec Sonnet pour aller vite">Passe rapide : {r.passe_rapide} plat(s) — régénérer avec Opus</div>}
                  {r.prep_attente > 0 && <div className="petit">Préparation : {r.prep_faits + r.prep_erreurs}/{r.prep_total} plats</div>}
                  {r.prep_erreurs > 0 && r.prep_attente === 0 && (
                    <form action={relancerPreparation.bind(null, r.id)} className="pile" style={{ gap: 4 }}>
                      <span className="petit" style={{ color: 'var(--ocre)' }}>{r.prep_erreurs} plat(s) en échec</span>
                      <button className="btn sec petit">Relancer la préparation</button>
                    </form>
                  )}</td>
                <td>{r.producteurs ? <Link href="/admin/super/producteurs">{r.producteurs}</Link> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={creerRestaurant} className="carte-bo pile" style={{ maxWidth: 640 }}>
        <h2>Créer un restaurant</h2>
        <div className="champ"><label htmlFor="nom">Nom du restaurant</label><input id="nom" name="nom" required /></div>
        <div className="champ"><label htmlFor="email">E-mail du responsable</label><input id="email" name="email" type="email" required />
          <span className="aide">Il reçoit une invitation pour choisir son mot de passe et accéder à l’espace de son restaurant.</span></div>
        <div className="champ"><label htmlFor="ville">Ville</label><input id="ville" name="ville" /></div>
        <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, marginBottom: 6 }}>Langues</legend>
          <div style={{ display: 'flex', gap: 16 }}>
            {[['fr', 'Français'], ['nl', 'Nederlands'], ['en', 'English']].map(([k, l]) => (
              <label key={k} className="case"><input type="checkbox" name={`langue_${k}`} defaultChecked={k === 'fr'} /><span>{l}</span></label>))}
          </div>
        </fieldset>
        <div className="champ"><label htmlFor="couleur">Couleur</label><input id="couleur" name="couleur" type="color" defaultValue="#610420" style={{ width: 80, height: 40 }} /></div>
        <p className="discret" style={{ margin: 0 }}>Règles de départ : celles de Pat en service ({ind.regles ?? 'V7'}) ; le restaurant pourra les ajuster.</p>
        <span><button className="btn">Créer et inviter</button></span>
      </form>
    </>
  );
}
