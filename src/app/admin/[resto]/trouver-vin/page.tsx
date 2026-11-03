// Base des vins — « Trouver un vin » (sous Ma cave) : le restaurant décrit ce qu'il cherche (plat, pays, budget…),
// Pat propose 2 vins par distributeur Quid Vinum, avec un petit texte, et chacun s'ajoute à Ma cave.
import Link from 'next/link';
import { lancerRechercheVin } from '../../trouver-vin-actions';
import { ajouterAuPanier, ajouterDuCatalogue } from '../../stocks-actions';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { AjoutCatalogue, AjoutPanier } from '@/components/admin/Panier';
import { VignetteVin } from '@/components/admin/VignetteVin';
import { Entete, Message } from '@/components/admin/Ui';
import { exigerAcces, utilisateurCourant } from '@/lib/admin/auth';
import { euros } from '@/lib/bon-commande';
import { requete } from '@/lib/db';
import type { PropositionDistributeur } from '@/lib/recherche-vin';

const COULEURS = [['', 'Toutes'], ['bulles', 'Bulles'], ['blanc', 'Blanc'], ['rose', 'Rosé'], ['orange', 'Orange'], ['rouge', 'Rouge'], ['doux', 'Doux']] as const;
const date = (d: string) => new Date(d).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });

export default async function TrouverUnVin({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ r?: string; erreur?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const sp = await searchParams;
  const [plats, historique] = await Promise.all([
    requete<{ id: string; nom: string }>('select id, nom from plat where restaurant_id = $1 and actif order by ordre, nom', [resto]),
    requete<{ id: string; demande: string; statut: string; cree_le: string }>(
      'select id, demande, statut, cree_le::text from recherche_vin where restaurant_id = $1 order by cree_le desc limit 10', [resto]),
  ]);
  // Recherche affichée : celle demandée, sinon la dernière.
  const u = await utilisateurCourant();
  const [r] = await requete<{ id: string; demande: string; statut: string; message: string | null; erreur: string | null; resultat: PropositionDistributeur[] | null; cree_le: string }>(
    `select id, demande, statut, message, erreur, resultat, cree_le::text from recherche_vin where restaurant_id = $1 and ($2::text is null or id = $2) order by cree_le desc limit 1`,
    [resto, sp.r ?? null]);
  // Une recherche restée « en cours » plus de 5 minutes a échoué (serveur redémarré…).
  const enCours = r?.statut === 'en_cours' && Date.now() - new Date(r.cree_le).getTime() < 5 * 60_000;
  const ids = (r?.resultat ?? []).flatMap((d) => d.vins.map((v) => v.id));
  const dansCave = new Map((ids.length ? await requete<{ distributeur_vin_id: string; id: string; panier: number }>(
    `select distinct on (v.distributeur_vin_id) v.distributeur_vin_id, v.id, coalesce(p.quantite, 0) as panier
       from vin_carte v left join panier p on p.restaurant_id = v.restaurant_id and p.vin_id = v.id
      where v.restaurant_id = $1 and v.distributeur_vin_id = any($2) order by v.distributeur_vin_id, v.disponible desc`, [resto, ids]) : []).map((x) => [x.distributeur_vin_id, x]));

  return (
    <>
      <Entete titre="Trouver un vin" texte="Décrivez ce que vous cherchez : Pat parcourt les catalogues des distributeurs Quid Vinum et vous propose deux vins chez chacun, en expliquant pourquoi." />
      <Message erreur={sp.erreur} />
      <form action={lancerRechercheVin.bind(null, resto)} className="carte-bo pile" style={{ maxWidth: 900 }}>
        <div className="champ" style={{ margin: 0 }}><label htmlFor="demande">Votre demande</label>
          <textarea id="demande" name="demande" rows={4} maxLength={2000}
            placeholder="Ex. Un blanc pour notre nouveau plat de saint-jacques au beurre blanc, plutôt Loire ou Bourgogne, moins de 20 € HTVA." /></div>
        <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
          <div className="champ" style={{ margin: 0 }}><label htmlFor="plat">Un plat de votre menu <span className="discret">(facultatif)</span></label>
            <select id="plat" name="plat" defaultValue=""><option value="">—</option>{plats.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></div>
          <div className="champ" style={{ margin: 0 }}><label htmlFor="budget">Budget maximum HTVA <span className="discret">(facultatif)</span></label>
            <input id="budget" name="budget" inputMode="decimal" placeholder="Ex. 20" /></div>
          <div className="champ" style={{ margin: 0 }}><label htmlFor="couleur">Couleur <span className="discret">(facultatif)</span></label>
            <select id="couleur" name="couleur" defaultValue="">{COULEURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        </div>
        <span><button className="btn rouge">Chercher avec Pat</button></span>
      </form>

      {r && (
        <section className="pile" style={{ gap: 14 }}>
          <div><h2 style={{ margin: 0 }}>Propositions de Pat</h2><p className="petit discret" style={{ margin: '4px 0 0' }}>« {r.demande} » · {date(r.cree_le)}</p></div>
          {enCours && (
            <p className="carte-bo" style={{ margin: 0 }}><ActualisationAuto secondes={3} />Pat parcourt les catalogues et choisit ses vins… (20 à 40 secondes)</p>
          )}
          {r.statut === 'en_cours' && !enCours && <p className="message erreur">La recherche n’a pas abouti : relancez-la.</p>}
          {r.statut !== 'en_cours' && r.message && <p className={`message ${r.statut === 'echec' ? 'erreur' : ''}`}>{r.message}</p>}
          {/* Détail technique d'un échec : pour Pat (super-admin) seulement. */}
          {u?.admin && r.erreur && <p className="petit discret" style={{ margin: 0 }}>Détail (super-admin) : {r.erreur}</p>}
          {(r.resultat ?? []).map((d) => (
            <article key={d.id} className="carte-bo pile" style={{ gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {d.logo && <img src={d.logo} alt="" style={{ maxWidth: 110, maxHeight: 40, objectFit: 'contain' }} />}
                <h3 style={{ margin: 0 }}>{d.nom}</h3>
                <Link href={`/admin/${resto}/fournisseurs/${d.id}`} className="petit" style={{ marginLeft: 'auto' }}>Voir son catalogue →</Link>
              </div>
              {d.vins.map((v) => {
                const x = dansCave.get(v.id);
                return (
                  <div key={v.id} className="proposition-vin">
                    <VignetteVin url={v.etiquette} logo={d.logo} taille={56} />
                    <div className="pile" style={{ gap: 4, flex: 1 }}>
                      <b>{v.libelle}{v.millesime && !v.libelle.includes(v.millesime) ? ` ${v.millesime}` : ''}</b>
                      <span className="petit discret">{[v.producteur, v.appellation, v.contenance].filter(Boolean).join(' · ')}</span>
                      <p style={{ margin: '4px 0 0' }}>{v.pourquoi}</p>
                    </div>
                    <div className="pile" style={{ gap: 6, alignItems: 'flex-end', minWidth: 150 }}>
                      <b style={{ whiteSpace: 'nowrap' }}>{v.prix != null ? `${euros(v.prix)} HTVA` : '—'}</b>
                      {x ? <><Link href={`/admin/${resto}/carte/${encodeURIComponent(x.id)}?${new URLSearchParams({ retour: `/admin/${resto}/stocks` })}`} className="petit">✓ Dans ma cave</Link>
                          <AjoutPanier ajouter={ajouterAuPanier.bind(null, resto, x.id)} libelle={v.libelle} dansPanier={x.panier} /></>
                        : <AjoutCatalogue ajouter={ajouterDuCatalogue.bind(null, resto, d.id, v.id)} libelle={v.libelle} texte="+ Ajouter à ma cave" />}
                    </div>
                  </div>
                );
              })}
            </article>
          ))}
        </section>
      )}

      {historique.length > 1 && (
        <details className="carte-bo">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Vos dernières recherches</summary>
          <ul className="pile" style={{ gap: 6, margin: '10px 0 0', paddingLeft: 18 }}>
            {historique.map((h) => (
              <li key={h.id}><Link href={`?${new URLSearchParams({ r: h.id })}`}>{h.demande.length > 110 ? `${h.demande.slice(0, 110)}…` : h.demande}</Link>
                <span className="petit discret"> · {date(h.cree_le)}{h.statut === 'echec' ? ' · échec' : ''}</span></li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
