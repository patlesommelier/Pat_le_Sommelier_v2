import Link from 'next/link';
import { enregistrerReglesDefaut, preparer } from '../actions';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { requete } from '@/lib/db';
import { dernierePublication } from '@/lib/publication/publication';
import { brouillonRegles, listeVersionsRegles, reglesEnService } from '@/lib/regles/versions';
import { REGLAGES_PAT, type Reglages } from '@/lib/selection';
import { exigerAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

// Paramètres des règles de sélection (V7), dans l'ordre du fichier regles_selection.xlsx.
const PARAMETRES: { cle: keyof Reglages; libelle: string; aide: string; pas?: number }[] = [
  { cle: 'contenance', libelle: 'Une seule contenance (règle 10)', aide: 'un vin en 75 cl et en 37,5 cl ne compte qu’en 75 cl' },
  { cle: 'noteEliminatoire', libelle: 'Écarter les notes ≤ (règle 1)', aide: 'note minimale pour être proposé : cette valeur + 1' },
  { cle: 'diversite', libelle: 'Diversité (règle 3)', aide: 'à égalité, le vin le plus différent des vins déjà retenus' },
  { cle: 'premiers', libelle: 'Premiers vins (règles 3 à 5)', aide: 'nombre de vins proposés d’office' },
  { cle: 'maximum', libelle: 'Maximum (règle 9)', aide: 'nombre de vins au plus' },
  { cle: 'noteMinAjout', libelle: 'Note pour compléter (règle 6a)', aide: '4e et 5e vins : note minimale' },
  { cle: 'scoreMinAjout', libelle: 'Score pour compléter (règle 6c, interne)', aide: '4e et 5e vins : score minimal (note + ranking producteur)' },
  { cle: 'plusCher', libelle: 'Vin plus cher (règle 7)', aide: 'ajouter un vin d’exception' },
  { cle: 'facteurPlusCher', libelle: 'Facteur « plus cher » (7b)', aide: 'prix ≥ facteur × le plus cher de la liste', pas: 0.1 },
  { cle: 'moinsCher', libelle: 'Vin moins cher (règle 8)', aide: 'ajouter un vin plus accessible' },
  { cle: 'ecartMoinsCher', libelle: 'Écart « moins cher » (8)', aide: 'déclenché si le moins cher de la liste dépasse cet écart', pas: 0.1 },
  { cle: 'plafondBulles', libelle: 'Bulles au plus (règle 11)', aide: 'nombre de vins effervescents au plus' },
  { cle: 'tourSuivant', libelle: 'Tour suivant', aide: 'vins proposés quand le client veut autre chose' },
];
const date = (d: string | null) => (d ? new Date(d).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Règles de sélection par défaut de Pat : brouillon, versions, ajustements des restaurants, publication. */
export default async function ReglesDefaut({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [service, b, versions, pub, restos] = await Promise.all([reglesEnService(requete), brouillonRegles(requete), listeVersionsRegles(requete),
    dernierePublication(requete, 'regles'), requete<{ id: string; nom: string; reglages_selection: Record<string, unknown> }>('select id, nom, reglages_selection from restaurant order by nom')]);
  const P = b?.parametres ?? service?.parametres ?? REGLAGES_PAT;
  const S = service?.parametres ?? REGLAGES_PAT;
  const libelle = (k: string) => PARAMETRES.find((p) => p.cle === k)?.libelle ?? k;

  return (
    <>
      <Entete titre="Règles par défaut" texte="Les règles de sélection que Pat applique à tous les restaurants. Chaque restaurant peut en ajuster certaines dans son espace ; les réglages internes (score) restent les vôtres." />
      <Message ok={sp.ok} erreur={sp.erreur} />
      <div className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <span>En service : <b>{service?.code ?? 'V7 (code)'}</b>{' · '}{b ? <>Brouillon : <b>{b.code}</b></> : 'Pas de brouillon : modifiez un paramètre ci-dessous pour en créer un.'}</span>
        {b && <form action={preparer.bind(null, 'regles')}><button className="btn">Publier les règles</button></form>}
        {pub && pub.statut !== 'annulee' && <span className="petit" style={{ flexBasis: '100%' }}>Dernière publication : <Link href={`/admin/super/publications/${pub.id}`}>{pub.code} — {pub.statut === 'confirmee' ? 'mise en service' : 'prête à mettre en service'}</Link></span>}
      </div>

      <form action={enregistrerReglesDefaut} className="carte-bo pile">
        <h2>{b ? `Brouillon ${b.code}` : 'Nouveau brouillon'}</h2>
        <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 12 }}>
          {PARAMETRES.map((p) => (
            <div key={p.cle} className="champ">
              {typeof REGLAGES_PAT[p.cle] === 'boolean'
                ? <label className="case"><input type="checkbox" name={p.cle} defaultChecked={P[p.cle] as boolean} /><span>{p.libelle}<small>{p.aide}</small></span></label>
                : <><label htmlFor={p.cle}>{p.libelle}</label>
                  <input id={p.cle} name={p.cle} type="number" step={p.pas ?? 1} defaultValue={String(P[p.cle])} style={{ maxWidth: 120 }} />
                  <span className="aide">{p.aide}</span></>}
              {P[p.cle] !== S[p.cle] && <span className="petit" style={{ color: 'var(--ocre)' }}>En service : {String(S[p.cle])}</span>}
            </div>
          ))}
        </div>
        <div className="champ"><label htmlFor="notes">Notes de version</label><input id="notes" name="notes" defaultValue={b?.notes ?? ''} /></div>
        <span><button className="btn sec">Enregistrer le brouillon</button></span>
      </form>

      <section className="pile" style={{ gap: 8 }}>
        <h2>Ajustements des restaurants</h2>
        {restos.map((r) => {
          const aj = Object.entries(r.reglages_selection ?? {});
          return <span key={r.id} style={{ fontSize: 14.5 }}><b>{r.nom}</b> : {aj.length ? aj.map(([k, v]) => `${libelle(k)} = ${String(v)}`).join(' · ') : 'règles de Pat, sans ajustement'}</span>;
        })}
      </section>

      <section className="pile" style={{ gap: 8 }}>
        <h2>Versions</h2>
        <div className="tableau"><table style={{ minWidth: 480 }}>
          <thead><tr><th>Version</th><th>Statut</th><th>Notes</th><th>Mise en service</th></tr></thead>
          <tbody>{versions.map((v) => (
            <tr key={v.code}><td><b>{v.code}</b></td><td><Etat type={v.statut === 'en_service' ? 'ok' : v.statut === 'brouillon' ? 'propose' : ''}>{v.statut.replace('_', ' ')}</Etat></td>
              <td className="petit">{v.notes ?? '—'}</td><td className="petit">{date(v.publie_le)}</td></tr>))}
          </tbody></table></div>
      </section>
    </>
  );
}
