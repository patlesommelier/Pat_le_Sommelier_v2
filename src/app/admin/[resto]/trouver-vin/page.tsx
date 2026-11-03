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

export default async function TrouverUnVin({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ r?: string; erreur?: string; nouvelle?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const sp = await searchParams;
  type Recherche = { id: string; demande: string; plat_id: string | null; budget: number | null; couleur: string | null; statut: string; message: string | null;
    erreur: string | null; resultat: PropositionDistributeur[] | null; cree_le: string };
  const [plats, recherches, u] = await Promise.all([
    requete<{ id: string; nom: string }>('select id, nom from plat where restaurant_id = $1 and actif order by ordre, nom', [resto]),
    requete<Recherche>(`select id, demande, plat_id, budget::float8 as budget, couleur, statut, message, erreur, resultat, cree_le::text
                          from recherche_vin where restaurant_id = $1 order by cree_le desc limit 10`, [resto]),
    utilisateurCourant(),
  ]);
  // Formulaire : rempli avec la recherche reprise (?r=…) ; vide sinon. Recherche dépliée : celle-ci, sinon la dernière.
  const reprise = sp.r ? recherches.find((x) => x.id === sp.r) ?? null : null;
  const ouverte = sp.r ?? (sp.nouvelle ? null : recherches[0]?.id ?? null);
  const nomPlat = new Map(plats.map((p) => [p.id, p.nom]));
  // Une recherche restée « en cours » plus de 5 minutes a échoué (serveur redémarré…).
  const enCours = (x: Recherche) => x.statut === 'en_cours' && Date.now() - new Date(x.cree_le).getTime() < 5 * 60_000;
  const ids = recherches.flatMap((x) => (x.resultat ?? []).flatMap((d) => d.vins.map((v) => v.id)));
  const dansCave = new Map((ids.length ? await requete<{ distributeur_vin_id: string; id: string; panier: number }>(
    `select distinct on (v.distributeur_vin_id) v.distributeur_vin_id, v.id, coalesce(p.quantite, 0) as panier
       from vin_carte v left join panier p on p.restaurant_id = v.restaurant_id and p.vin_id = v.id
      where v.restaurant_id = $1 and v.distributeur_vin_id = any($2) order by v.distributeur_vin_id, v.disponible desc`, [resto, ids]) : []).map((x) => [x.distributeur_vin_id, x]));
  const r = reprise;

  return (
    <>
      <Entete titre="Rajouter un vin" texte="Décrivez ce que vous cherchez : Pat parcourt les catalogues des distributeurs Quid Vinum et vous propose ses vins chez chacun (quatre s’il y a un ou deux distributeurs, deux au-delà), en expliquant pourquoi." />
      <Message erreur={sp.erreur} />
      {/* Une recherche reprise (« Reprendre cette demande ») remplit le formulaire : on peut la modifier et relancer. */}
      <form key={r?.id ?? 'nouvelle'} action={lancerRechercheVin.bind(null, resto)} className="carte-bo pile" style={{ maxWidth: 900 }}>
        <div className="champ" style={{ margin: 0 }}><label htmlFor="demande">Votre demande</label>
          <textarea id="demande" name="demande" rows={4} maxLength={2000} defaultValue={r?.demande ?? ''}
            placeholder="Ex. Un blanc pour notre nouveau plat de saint-jacques au beurre blanc, plutôt Loire ou Bourgogne, moins de 20 € HTVA." /></div>
        <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
          <div className="champ" style={{ margin: 0 }}><label htmlFor="plat">Un plat de votre menu <span className="discret">(facultatif)</span></label>
            <select id="plat" name="plat" defaultValue={r?.plat_id ?? ''}><option value="">—</option>{plats.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></div>
          <div className="champ" style={{ margin: 0 }}><label htmlFor="budget">Budget maximum HTVA <span className="discret">(facultatif)</span></label>
            <input id="budget" name="budget" inputMode="decimal" placeholder="Ex. 20" defaultValue={r?.budget != null ? String(r.budget).replace('.', ',') : ''} /></div>
          <div className="champ" style={{ margin: 0 }}><label htmlFor="couleur">Couleur <span className="discret">(facultatif)</span></label>
            <select id="couleur" name="couleur" defaultValue={r?.couleur ?? ''}>{COULEURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        </div>
        <span className="ligne-actions" style={{ alignItems: 'center' }}><button className="btn rouge">Chercher avec Pat</button>
          {r && <Link href="?nouvelle=1" className="btn fantome petit">Nouvelle demande</Link>}</span>
      </form>

      {/* Chaque recherche se déplie (flèche) : la demande, et les propositions de Pat. */}
      {recherches.some(enCours) && <ActualisationAuto secondes={3} />}
      {recherches.length > 0 && (
        <section className="pile" style={{ gap: 12 }}>
          <h2 style={{ margin: 0 }}>Vos recherches</h2>
          {recherches.map((x) => (
            <details key={x.id} className="carte-bo bloc-fiche bloc-recherche" open={x.id === ouverte}>
              <summary>
                <span className="pile" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                  <b className="demande-resume">{x.demande}</b>
                  <span className="petit discret">{date(x.cree_le)}{enCours(x) ? ' · Pat cherche…' : x.statut === 'echec' || x.statut === 'en_cours' ? ' · échec' : ''}</span>
                </span>
              </summary>
              <div className="pile" style={{ gap: 12, marginTop: 12 }}>
                <span className="ligne-actions" style={{ alignItems: 'center' }}>
                  {[x.plat_id && nomPlat.get(x.plat_id) ? `Plat : ${nomPlat.get(x.plat_id)}` : null, x.budget != null ? `Budget : ${euros(x.budget)} HTVA` : null,
                    x.couleur ? `Couleur : ${COULEURS.find(([k]) => k === x.couleur)?.[1] ?? x.couleur}` : null].filter(Boolean).map((t) => <span key={t} className="petit discret">{t}</span>)}
                  <Link href={`?${new URLSearchParams({ r: x.id })}`} className="btn fantome petit">Reprendre cette demande</Link>
                </span>
                {enCours(x) && <p className="petit" style={{ margin: 0 }}>Pat parcourt les catalogues et choisit ses vins… (20 à 40 secondes)</p>}
                {x.statut === 'en_cours' && !enCours(x) && <p className="message erreur">La recherche n’a pas abouti : relancez-la.</p>}
                {x.statut !== 'en_cours' && x.message && <p className={`message ${x.statut === 'echec' ? 'erreur' : ''}`}>{x.message}</p>}
                {/* Détail technique d'un échec : pour Pat (super-admin) seulement. */}
                {u?.admin && x.erreur && <p className="petit discret" style={{ margin: 0 }}>Détail (super-admin) : {x.erreur}</p>}
                {(x.resultat ?? []).map((d) => (
                  <article key={d.id} className="pile proposition-distributeur" style={{ gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {d.logo && <img src={d.logo} alt="" style={{ maxWidth: 110, maxHeight: 40, objectFit: 'contain' }} />}
                      <h3 style={{ margin: 0 }}>{d.nom}</h3>
                    </div>
                    {d.vins.map((v) => {
                      const c = dansCave.get(v.id);
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
                            {c ? <><Link href={`/admin/${resto}/carte/${encodeURIComponent(c.id)}?${new URLSearchParams({ retour: `/admin/${resto}/stocks` })}`} className="petit">✓ Dans ma cave</Link>
                                <AjoutPanier ajouter={ajouterAuPanier.bind(null, resto, c.id)} libelle={v.libelle} dansPanier={c.panier} /></>
                              : <AjoutCatalogue ajouter={ajouterDuCatalogue.bind(null, resto, d.id, v.id)} libelle={v.libelle} texte="+ Ajouter" />}
                          </div>
                        </div>
                      );
                    })}
                  </article>
                ))}
              </div>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
