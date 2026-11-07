// Base des vins — « Ajouter un vin » (sous Ma cave) : un grand bandeau de recherche (la demande, le plat, le budget, la couleur),
// puis les propositions de Pat en vitrine (par distributeur Quid Vinum, avec son texte) et les recherches précédentes en pastilles.
import Link from 'next/link';
import { lancerRechercheVin } from '../../trouver-vin-actions';
import { ajouterAuPanier, ajouterDuCatalogue } from '../../stocks-actions';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { AjoutCatalogue, AjoutPanier } from '@/components/admin/Panier';
import { VignetteVin } from '@/components/admin/VignetteVin';
import { Message } from '@/components/admin/Ui';
import { exigerAcces, utilisateurCourant } from '@/lib/admin/auth';
import { euros } from '@/lib/bon-commande';
import { requete } from '@/lib/db';
import type { PropositionDistributeur } from '@/lib/recherche-vin';

const COULEURS = [['', 'Toutes couleurs'], ['bulles', 'Bulles'], ['blanc', 'Blanc'], ['rose', 'Rosé'], ['orange', 'Orange'], ['rouge', 'Rouge'], ['doux', 'Doux']] as const;
const date = (d: string) => new Date(d).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
const court = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t);

type Recherche = { id: string; demande: string; plat_id: string | null; budget: number | null; couleur: string | null; statut: string; message: string | null;
  erreur: string | null; resultat: PropositionDistributeur[] | null; cree_le: string };

export default async function RajouterUnVin({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ r?: string; erreur?: string; nouvelle?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const sp = await searchParams;
  const [plats, recherches, u] = await Promise.all([
    requete<{ id: string; nom: string }>('select id, nom from plat where restaurant_id = $1 and actif order by ordre, nom', [resto]),
    requete<Recherche>(`select id, demande, plat_id, budget::float8 as budget, couleur, statut, message, erreur, resultat, cree_le::text
                          from recherche_vin where restaurant_id = $1 order by cree_le desc limit 10`, [resto]),
    utilisateurCourant(),
  ]);
  // Recherche montrée en vitrine : celle choisie (?r=…), sinon la dernière ; « Nouvelle demande » vide tout.
  const r = sp.nouvelle ? null : (sp.r ? recherches.find((x) => x.id === sp.r) : recherches[0]) ?? null;
  // Formulaire : rempli avec la recherche choisie (pour la modifier et la relancer) ; vide pour une nouvelle demande.
  const reprise = sp.r ? r : null;
  const precedentes = recherches.filter((x) => x.id !== r?.id);
  // Une recherche restée « en cours » plus de 5 minutes a échoué (serveur redémarré…).
  const enCours = Boolean(r && r.statut === 'en_cours' && Date.now() - new Date(r.cree_le).getTime() < 5 * 60_000);
  // Propositions d'une recherche : seulement les distributeurs encore choisis par le restaurant (un distributeur désactivé disparaît).
  const actifs = new Set((await requete<{ distributeur_id: string }>('select distributeur_id from fournisseur where restaurant_id = $1 and distributeur_id is not null', [resto])).map((x) => x.distributeur_id));
  if (r?.resultat) r.resultat = r.resultat.filter((d) => actifs.has(d.id));
  const ids = (r?.resultat ?? []).flatMap((d) => d.vins.map((v) => v.id));
  const dansCave = new Map((ids.length ? await requete<{ distributeur_vin_id: string; id: string; panier: number }>(
    `select distinct on (v.distributeur_vin_id) v.distributeur_vin_id, v.id, coalesce(p.quantite, 0) as panier
       from vin_carte v left join panier p on p.restaurant_id = v.restaurant_id and p.vin_id = v.id
      where v.restaurant_id = $1 and v.distributeur_vin_id = any($2) order by v.distributeur_vin_id, v.disponible desc`, [resto, ids]) : []).map((x) => [x.distributeur_vin_id, x]));

  return (
    <>
      <Message erreur={sp.erreur} />
      {/* Bandeau de recherche. */}
      <form key={reprise?.id ?? 'nouvelle'} action={lancerRechercheVin.bind(null, resto)} className="bandeau-recherche">
        <h1>Quel vin cherchez-vous ?</h1>
        <p>Pat parcourt les catalogues de vos distributeurs et détermine quel serait le meilleur choix.</p>
        <div className="barre-recherche">
          <textarea name="demande" rows={2} maxLength={2000} defaultValue={reprise?.demande ?? ''} aria-label="Votre demande"
            placeholder="Ex. Un blanc pour notre nouveau plat de saint-jacques au beurre blanc, plutôt Loire ou Bourgogne." />
          <button className="btn rouge">Chercher avec Pat</button>
        </div>
        <div className="filtres-recherche">
          <label className="pastille-filtre"><span aria-hidden="true">🍽</span>
            <select name="plat" defaultValue={reprise?.plat_id ?? ''} aria-label="Un plat de votre menu"><option value="">Plat du menu</option>{plats.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></label>
          <label className="pastille-filtre"><span aria-hidden="true">€</span>
            <input name="budget" inputMode="decimal" placeholder="Budget maximum HTVA" aria-label="Budget maximum HTVA" defaultValue={reprise?.budget != null ? String(reprise.budget).replace('.', ',') : ''} /></label>
          <label className="pastille-filtre"><span aria-hidden="true">●</span>
            <select name="couleur" defaultValue={reprise?.couleur ?? ''} aria-label="Couleur">{COULEURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {reprise && <Link href="?nouvelle=1" className="pastille-filtre lien">✕ Nouvelle demande</Link>}
        </div>
      </form>
      {/* Vin déjà connu du restaurant : décrit à la main (il passe « En attente de validation »). */}
      <p style={{ margin: 0 }}>Vous savez déjà quel vin ajouter ? <Link href={`/admin/${resto}/trouver-vin/main`} className="btn sec petit">Ajouter un vin à la main →</Link></p>

      {r && (
        <section className="pile" style={{ gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Les propositions de Pat</h2>
            <span className="petit discret" title={r.demande}>{court(r.demande, 70)} · {date(r.cree_le)}</span>
          </div>
          {enCours && <p className="carte-bo" style={{ margin: 0 }}><ActualisationAuto secondes={3} />Pat parcourt les catalogues et choisit ses vins… (20 à 40 secondes)</p>}
          {r.statut === 'en_cours' && !enCours && <p className="message erreur">La recherche n’a pas abouti : relancez-la.</p>}
          {r.statut !== 'en_cours' && r.message && <p className={`message ${r.statut === 'echec' ? 'erreur' : ''}`}>{r.message}</p>}
          {/* Détail technique d'un échec : pour Pat (super-admin) seulement. */}
          {u?.admin && r.erreur && <p className="petit discret" style={{ margin: 0 }}>Détail (super-admin) : {r.erreur}</p>}
          {/* Toutes les propositions côte à côte (une seule rangée, qui défile si besoin) ; le distributeur sur chaque carte. */}
          {(r.resultat ?? []).length > 0 && (
            <div className="vitrine-vins">
              {(r.resultat ?? []).flatMap((d) => d.vins.map((v) => {
                const c = dansCave.get(v.id);
                return (
                  <article key={`${d.id}-${v.id}`} className="carte-vitrine">
                    <span className="etiquette-distributeur">{d.nom}</span>
                    <VignetteVin url={v.etiquette} logo={d.logo} taille={130} plein />
                    <b>{v.libelle}{v.millesime && !v.libelle.includes(v.millesime) ? ` ${v.millesime}` : ''}</b>
                    <span className="petit discret">{[v.producteur, v.appellation, v.contenance].filter(Boolean).join(' · ')}</span>
                    <p>{v.pourquoi}</p>
                    <div className="pied-vitrine">
                      <span className="prix-vitrine">{v.prix != null ? euros(v.prix) : '—'} <small>HTVA</small></span>
                      {c ? <span className="pile" style={{ gap: 4, alignItems: 'flex-end' }}>
                          <Link href={`/admin/${resto}/stocks?${new URLSearchParams({ nouveau: c.id })}#vin-${c.id}`} className="petit">✓ Dans ma cave</Link>
                          <AjoutPanier ajouter={ajouterAuPanier.bind(null, resto, c.id)} libelle={v.libelle} dansPanier={c.panier} /></span>
                        : <AjoutCatalogue ajouter={ajouterDuCatalogue.bind(null, resto, d.id, v.id)} libelle={v.libelle} texte="+ Ajouter" versCave={`/admin/${resto}/stocks`} />}
                    </div>
                  </article>
                );
              }))}
            </div>
          )}
        </section>
      )}

      {precedentes.length > 0 && (
        <section className="pile" style={{ gap: 8 }}>
          <h3 style={{ margin: 0 }}>Vos recherches précédentes</h3>
          <div className="ligne-actions">
            {precedentes.map((x) => (
              <Link key={x.id} href={`?${new URLSearchParams({ r: x.id })}`} className="pastille-recherche" title={x.demande}>
                {court(x.demande, 42)} · {date(x.cree_le)}{x.statut === 'echec' ? ' · échec' : ''}</Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
