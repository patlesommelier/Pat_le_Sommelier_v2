import Link from 'next/link';
import { notFound } from 'next/navigation';
import { decisionProducteur } from '../../actions';
import { Entete, Etat, Message, Vignette, euros } from '@/components/admin/Ui';
import { ficheProducteur } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blanc', rose: 'Rosé', rouge: 'Rouge', orange: 'Orange', doux: 'Doux' };
const STATUT: Record<string, [string, 'ok' | 'propose' | 'defaut']> = { valide: ['Validé', 'ok'], propose: ['À valider', 'propose'], retire: ['Rejeté', 'defaut'] };

/** Fiche d'un producteur proposé : informations, cuisine interne (rankings), vins des cartes, terroirs ; Rejeter / Enregistrer / Valider. */
export default async function FicheProducteurPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { id } = await params;
  const sp = await searchParams;
  const p = await ficheProducteur(decodeURIComponent(id));
  if (!p) notFound();
  const rk = p.ranking_pat ?? p.ranking_suggere;

  return (
    <>
      <Entete titre={p.nom} texte={[p.region, p.sous_region, p.pays].filter(Boolean).join(' · ') || 'Région à préciser'}>
        <Link href="/admin/super/producteurs" className="btn sec">← File d’attente</Link>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      <form action={decisionProducteur.bind(null, p.id)} className="pile" style={{ gap: 20 }}>
        <div className="carte-bo pile">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2>Fiche</h2>
            <Etat type={STATUT[p.statut]?.[1] ?? ''}>{STATUT[p.statut]?.[0] ?? p.statut}</Etat>
          </div>
          <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
            <div className="champ"><label htmlFor="nom">Nom</label><input id="nom" name="nom" defaultValue={p.nom} /></div>
            <div className="champ"><label htmlFor="pays">Pays</label><input id="pays" name="pays" defaultValue={p.pays ?? ''} /></div>
            <div className="champ"><label htmlFor="region">Région</label><input id="region" name="region" defaultValue={p.region ?? ''} /></div>
          </div>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(140px, auto) 1fr', gap: '6px 14px', fontSize: 14.5 }}>
            <dt style={{ fontWeight: 700 }}>Couleurs</dt><dd style={{ margin: 0 }}>{p.couleurs.join(', ') || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Cépages</dt><dd style={{ margin: 0 }}>{p.cepages_rois.join(', ') || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Appellations</dt><dd style={{ margin: 0 }}>{p.appellations_texte.join(', ') || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Gamme de prix</dt><dd style={{ margin: 0 }}>{p.gamme_prix ?? 'À vérifier'}</dd>
            <dt style={{ fontWeight: 700 }}>Production</dt><dd style={{ margin: 0 }}>{p.statut_production === 'inconnu' ? 'À vérifier' : p.statut_production}</dd>
            {p.source && <><dt style={{ fontWeight: 700 }}>Sources</dt><dd style={{ margin: 0 }}>{p.source}</dd></>}
          </dl>
          {p.notes_objectives && (
            // Texte complet de la fiche (super-admin seulement) ; l'app n'en montre que le début, sans la cuisine interne.
            <details className="interne" open style={{ borderRadius: 12, padding: '12px 16px' }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer' }}>Texte complet de la fiche</summary>
              <div className="pile" style={{ gap: 10, marginTop: 10, fontSize: 15, lineHeight: 1.6 }}>
                {p.notes_objectives.split(/\n{2,}/).map((para, i) => (
                  <p key={i} style={{ margin: 0 }}>{para.split('**').map((morceau, j) => (j % 2 ? <strong key={j}>{morceau}</strong> : morceau))}</p>
                ))}
              </div>
            </details>
          )}
          <div className="champ"><label htmlFor="notes_objectives">Texte de la fiche (modifiable)</label><textarea id="notes_objectives" name="notes_objectives" rows={10} defaultValue={p.notes_objectives ?? ''} />
            <span className="aide">Pour un producteur placé à 4 ou plus, l’app montre aux clients le début de ce texte (« Le domaine »), jamais le « Profil Pat », les prix ni les notes.</span></div>
          {p.a_verifier && <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)', margin: 0 }}>À vérifier : {p.a_verifier}</p>}
        </div>

        <div className="carte-bo pile interne">
          <h2>Cuisine interne</h2>
          <p className="discret" style={{ margin: 0 }}>Jamais visible par les restaurants. Le ranking du producteur vaut pour ses vins sans ranking propre ; une cuvée peut garder le sien (second vin plus bas que le grand vin).</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>Ranking du producteur (0 à 5)
            <input className="rk" name="ranking" type="number" min={0} max={5} step={1} defaultValue={rk ?? ''} required />
            {p.ranking_suggere !== null && <span className="petit discret" style={{ fontWeight: 400 }}>suggestion de Pat : {p.ranking_suggere}</span>}
          </label>
        </div>

        <div className="pile" style={{ gap: 10 }}>
          <h2>Ses vins</h2>
          <div className="tableau">
            <table style={{ minWidth: 760 }}>
              <thead><tr><th>Vin</th><th>Couleur</th><th>Terroir</th><th>Carte</th><th className="droite">Prix</th><th>Origine</th><th className="droite">Ranking de la cuvée</th></tr></thead>
              <tbody>
                {p.vins.map((v) => (
                  <tr key={v.id}>
                    <td><div className="vin-cell"><Vignette url={v.etiquette_url} taille={40} /><div><b>{v.libelle}</b>{v.millesime ? ` ${v.millesime}` : ''}<div className="petit discret">{v.id}</div></div></div></td>
                    <td>{COULEURS[v.couleur] ?? v.couleur}</td>
                    <td>{v.terroir ?? '—'}</td>
                    <td>{v.restaurant}</td>
                    <td className="droite">{euros(v.prix)}</td>
                    <td><Etat type="propose">Repéré sur une carte</Etat></td>
                    <td className="droite"><input className="rk" name={`rkv_${v.id}`} type="number" min={0} max={5} step={1} defaultValue={v.ranking_producteur ?? ''}
                      placeholder={rk !== null ? String(rk) : ''} aria-label={`Ranking de ${v.libelle}`} /></td>
                  </tr>
                ))}
                {p.cuvees.map((c) => (
                  <tr key={c.id}>
                    <td><div className="vin-cell"><Vignette url={c.etiquette_url} taille={40} /><b>{c.nom}</b></div></td>
                    <td>{c.couleur ? COULEURS[c.couleur] ?? c.couleur : '—'}</td><td>{c.appellation ?? '—'}</td>
                    <td>—</td><td /><td><Etat type="ok">{c.source === 'carte' ? 'Cuvée reprise d’une carte' : 'Proposé par Pat'}</Etat></td><td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="petit discret">Ranking de la cuvée vide : celui du producteur s’applique.</span>
        </div>

        {p.terroirs.length > 0 && (
          <div className="carte-bo pile interne">
            <h2>Terroirs de ces vins</h2>
            <p className="discret" style={{ margin: 0 }}>Le ranking d’un terroir vaut pour tous les vins de ce terroir, dans tous les restaurants.</p>
            {p.terroirs.map((t) => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ minWidth: 220 }}><b>{t.nom}</b>{t.region ? <span className="discret"> · {t.region}</span> : null}</span>
                <input className="rk" name={`rkt_${t.id}`} type="number" min={0} max={5} step={1} defaultValue={t.ranking_pat ?? ''} aria-label={`Ranking du terroir ${t.nom}`} />
              </label>
            ))}
          </div>
        )}

        {p.statut === 'valide' ? (
          // Producteur déjà validé (ouvert depuis la base ou une carte) : on corrige la fiche, sans le rejeter ni le revalider.
          <div className="ligne-actions">
            <button className="btn" name="decision" value="enregistrer">Enregistrer la fiche</button>
          </div>
        ) : (
          <div className="carte-bo pile">
            <div className="champ"><label htmlFor="motif">Motif du rejet (si vous rejetez)</label><input id="motif" name="motif" /></div>
            <div className="ligne-actions">
              <button className="btn sec" name="decision" value="rejeter" formNoValidate>Rejeter</button>
              <button className="btn sec" name="decision" value="enregistrer">Enregistrer</button>
              <button className="btn" name="decision" value="valider">Valider la fiche</button>
            </div>
          </div>
        )}
      </form>
    </>
  );
}
