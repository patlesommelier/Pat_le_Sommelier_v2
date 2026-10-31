// Super-admin — appellations de la base de Pat : à valider, regroupements proposés (doublons), appellations écrites sur des vins
// mais inconnues de la base, et la liste complète (modifier, ranking, regrouper dans une autre).
import Link from 'next/link';
import { ajouterAppellationSaisie, modifierAppellation, regrouper, regrouperDans, relierAppellationSaisie, validerAppellations } from '../appellations-actions';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { BarreValidation, CocherTout } from '@/components/admin/ValidationGroupee';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { doublonsProbables, listeAppellations, PAR_PAGE, saisiesNonReliees } from '@/lib/appellations/base';

export const dynamic = 'force-dynamic';

const STATUT: Record<string, [string, 'ok' | 'propose' | 'defaut']> = { valide: ['Validée', 'ok'], propose: ['À valider', 'propose'], retire: ['Retirée', 'defaut'] };
const NIVEAUX = ['appellation', 'zone', 'cru', 'lieu-dit', 'autre'];
const ranking = (n: number | null) => (n == null ? '—' : `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`);
type Sp = { q?: string; statut?: string; niveau?: string; page?: string; ok?: string; erreur?: string };

export default async function Appellations({ searchParams }: { searchParams: Promise<Sp> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ lignes, total }, groupes, saisies, noms] = await Promise.all([
    listeAppellations({ texte: sp.q ?? '', statut: sp.statut ?? '', niveau: sp.niveau ?? '', page }),
    doublonsProbables(), saisiesNonReliees(),
    requete<{ nom: string }>(`select distinct nom from terroir where statut <> 'retire' order by nom`),
  ]);
  const ici = `/admin/super/appellations?${new URLSearchParams(Object.entries({ q: sp.q, statut: sp.statut, niveau: sp.niveau, page: sp.page }).filter(([, v]) => v) as [string, string][])}`;
  const lien = (p: number) => `/admin/super/appellations?${new URLSearchParams(Object.entries({ q: sp.q, statut: sp.statut, niveau: sp.niveau, page: String(p) }).filter(([, v]) => v) as [string, string][])}`;
  const pages = Math.ceil(total / PAR_PAGE);

  return (
    <>
      <Entete titre="Appellations" texte="Les appellations (et terroirs) de la base de Pat. Une appellation saisie dans la fiche d’un vin et inconnue de la base y est ajoutée « à valider ». Son ranking vaut pour tous ses vins, dans tous les restaurants." />
      <Message ok={sp.ok} erreur={sp.erreur} />
      <datalist id="appellations-base">{noms.map((n) => <option key={n.nom} value={n.nom} />)}</datalist>

      {groupes.length > 0 && (
        <section className="carte-bo pile" id="regroupements">
          <div><h2>Regroupements proposés <span className="discret" style={{ fontWeight: 500 }}>{groupes.length}</span></h2>
            <p className="sous">Des appellations aux noms très proches (même région) : choisissez celle à garder ; ses vins, ses producteurs et ses sous-terroirs reçoivent ceux des autres, qui sont retirées.</p></div>
          {groupes.map((g) => (
            <form key={g[0].id} action={regrouper} className="ligne-producteur">
              <input type="hidden" name="retour" value={ici} />
              <div className="pile" style={{ gap: 6, flex: '1 1 420px' }}>
                {g.map((a, i) => (
                  <div key={a.id} className="ligne-actions" style={{ alignItems: 'center', gap: 10 }}>
                    <label className="petit" title="Appellation à garder"><input type="radio" name="cible" value={a.id} defaultChecked={i === 0} /> garder</label>
                    <label className="petit" title="À regrouper dans celle à garder"><input type="checkbox" name="sources" value={a.id} defaultChecked={i > 0} /> regrouper</label>
                    <span><b>{a.nom}</b> <span className="discret petit">· {a.region ?? 'région ?'} · {a.niveau} · {a.vins} vin{a.vins > 1 ? 's' : ''}</span> {a.statut === 'propose' && <Etat type="propose">à valider</Etat>}</span>
                  </div>
                ))}
              </div>
              <span><button className="btn sec petit">Regrouper</button></span>
            </form>
          ))}
        </section>
      )}

      {saisies.length > 0 && (
        <section className="carte-bo pile" id="saisies">
          <div><h2>Appellations écrites sur des vins, absentes de la base <span className="discret" style={{ fontWeight: 500 }}>{saisies.length}</span></h2>
            <p className="sous">Reliez-les à l’appellation de la base qui convient, ou ajoutez-les (à valider) : leurs vins prennent alors le ranking de l’appellation.</p></div>
          {saisies.map((s) => (
            <div key={s.texte} className="ligne-producteur">
              <div style={{ flex: '1 1 240px' }}><b>{s.texte}</b><div className="discret petit">{[s.vins_base ? `${s.vins_base} vin${s.vins_base > 1 ? 's' : ''} de la base` : null, s.vins_cartes ? `${s.vins_cartes} vin${s.vins_cartes > 1 ? 's' : ''} de cartes` : null].filter(Boolean).join(' · ')}</div></div>
              <div className="ligne-actions" style={{ alignItems: 'center', flex: '2 1 380px' }}>
                {s.proche && <FormulaireAdmin action={relierAppellationSaisie.bind(null, s.texte, s.proche.id)}><button className="btn sec petit">Relier à « {s.proche.nom} »</button></FormulaireAdmin>}
                <FormulaireAdmin action={ajouterAppellationSaisie.bind(null, s.texte)}><button className="btn fantome petit">+ Ajouter à la base</button></FormulaireAdmin>
                <details><summary className="petit" style={{ cursor: 'pointer' }}>Autre…</summary>
                  <FormulaireAdmin action={relierAppellationSaisie.bind(null, s.texte, null)} className="ligne-actions" style={{ alignItems: 'center', marginTop: 6 }}>
                    <input name="dans" list="appellations-base" className="champ-liste" placeholder="Appellation de la base" style={{ minWidth: 220, width: 'auto' }} aria-label={`Appellation de la base pour ${s.texte}`} />
                    <button className="btn sec petit">Relier</button>
                  </FormulaireAdmin>
                </details>
              </div>
            </div>
          ))}
        </section>
      )}

      <form className="carte-bo" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div className="champ" style={{ flex: '2 1 240px' }}><label htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={sp.q ?? ''} placeholder="Appellation ou région…" /></div>
        <div className="champ"><label htmlFor="statut">Statut</label>
          <select id="statut" name="statut" defaultValue={sp.statut ?? ''}><option value="">Toutes</option><option value="propose">À valider</option><option value="valide">Validées</option><option value="retire">Retirées</option></select></div>
        <div className="champ"><label htmlFor="niveau">Niveau</label>
          <select id="niveau" name="niveau" defaultValue={sp.niveau ?? ''}><option value="">Tous</option>{NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        <button className="btn">Filtrer</button>
      </form>

      <BarreValidation action={validerAppellations} retour={ici} />
      <div className="carte-bo" style={{ padding: 0 }}>
        <div className="tableau">
          <table style={{ minWidth: 900 }}>
            <thead><tr><th><CocherTout /></th><th>Appellation</th><th>Niveau</th><th>Région</th><th>Ranking</th><th className="droite">Vins base</th><th className="droite">Vins cartes</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {!lignes.length && <tr><td colSpan={9} className="discret">Aucune appellation ne correspond.</td></tr>}
              {lignes.map((a) => (
                <tr key={a.id} style={a.statut === 'retire' ? { opacity: 0.55 } : undefined}>
                  <td style={{ width: 28 }}>{a.statut === 'propose' && <input type="checkbox" name="ids" value={a.id} form="valider-lot" aria-label="Sélectionner cette appellation à valider" />}</td>
                  <td><b>{a.nom}</b>{a.fusionne_dans_nom && <div className="petit discret">regroupée dans {a.fusionne_dans_nom}</div>}{a.source === 'saisie' && a.statut === 'propose' && <div className="petit discret">saisie dans un vin</div>}</td>
                  <td className="petit">{a.niveau}</td>
                  <td className="petit">{[a.region, a.pays].filter(Boolean).join(' · ') || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--encre)' }}>{ranking(a.ranking_pat)}</td>
                  <td className="droite">{a.vins_base || '—'}</td>
                  <td className="droite">{a.vins_cartes || '—'}</td>
                  <td><Etat type={STATUT[a.statut]?.[1] ?? ''}>{STATUT[a.statut]?.[0] ?? a.statut}</Etat></td>
                  <td className="droite" style={{ minWidth: 190 }}>
                    <span className="ligne-actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap', alignItems: 'center' }}>
                      {a.statut === 'propose' && (
                        <form action={validerAppellations}><input type="hidden" name="ids" value={a.id} /><input type="hidden" name="retour" value={ici} /><button className="btn petit">Valider</button></form>
                      )}
                      <details className="details-ligne">
                        <summary className="lien-ligne" style={{ cursor: 'pointer' }}>Modifier</summary>
                        <div className="pile" style={{ gap: 10, marginTop: 8, textAlign: 'left' }}>
                          <FormulaireAdmin action={modifierAppellation.bind(null, a.id)} className="pile" style={{ gap: 8 }}>
                            <div className="champ"><label>Nom</label><input name="nom" defaultValue={a.nom} required /></div>
                            <div className="champ"><label>Niveau</label><select name="niveau" defaultValue={a.niveau}>{NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                            <div className="champ"><label>Région</label><input name="region" defaultValue={a.region ?? ''} /></div>
                            <div className="champ"><label>Pays</label><input name="pays" defaultValue={a.pays ?? ''} /></div>
                            <div className="champ"><label>Ranking (0 à 5)</label><select name="ranking" defaultValue={a.ranking_pat ?? ''}><option value="">—</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                            <div className="champ"><label>Statut</label><select name="statut" defaultValue={a.statut}><option value="valide">Validée</option><option value="propose">À valider</option><option value="retire">Retirée</option></select></div>
                            <button className="btn petit">Enregistrer</button>
                          </FormulaireAdmin>
                          {a.statut !== 'retire' && (
                            <FormulaireAdmin action={regrouperDans.bind(null, a.id)} className="pile" style={{ gap: 6 }}>
                              <div className="champ"><label>Regrouper dans…</label><input name="dans" list="appellations-base" placeholder="Appellation à garder" /></div>
                              <button className="btn sec petit">Regrouper</button>
                            </FormulaireAdmin>
                          )}
                        </div>
                      </details>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pages > 1 && (
        <div className="ligne-actions" style={{ alignItems: 'center' }}>
          {page > 1 && <Link href={lien(page - 1)} className="btn sec petit">← Précédentes</Link>}
          <span className="discret petit">Page {page} sur {pages} · {total} appellations</span>
          {page < pages && <Link href={lien(page + 1)} className="btn sec petit">Suivantes →</Link>}
        </div>
      )}
    </>
  );
}
