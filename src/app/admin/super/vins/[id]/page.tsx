import Link from 'next/link';
import { notFound } from 'next/navigation';
import { enregistrerCuvee, fusionnerCuvee } from '../../actions';
import { FormulaireFusion } from '@/components/admin/FormulaireFusion';
import { Entete, Etat, Message, Vignette, euros } from '@/components/admin/Ui';
import { PhotoEtiquette } from '@/components/admin/PhotoEtiquette';
import { ficheCuvee } from '@/lib/super/donnees';
import { requete } from '@/lib/db';
import { etatEtiquetteBase, etatEtiquetteVin } from '@/lib/etiquettes/etat';
import { exigerAdmin } from '@/lib/admin/auth';

const COULEURS: [string, string][] = [['bulles', 'Bulles'], ['blanc', 'Blanc'], ['rose', 'Rosé'], ['rouge', 'Rouge'], ['orange', 'Orange'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']];
const STATUT: Record<string, [string, 'ok' | 'propose' | 'defaut']> = { valide: ['Validé', 'ok'], propose: ['À valider', 'propose'], retire: ['Retiré', 'defaut'] };

/** Fiche d'un vin de la base de Pat : informations, étiquette, vins des cartes reliés ; Enregistrer / Valider / Retirer. */
export default async function FicheVinBase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string; retour?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { id } = await params;
  const sp = await searchParams;
  const [c, appellations, producteurs] = await Promise.all([ficheCuvee(decodeURIComponent(id)),
    requete<{ nom: string }>(`select distinct nom from terroir where statut <> 'retire' order by nom`),
    requete<{ nom: string; lieu: string | null }>(`select distinct on (nom) nom, nullif(concat_ws(', ', region, pays), '') as lieu from producteur where statut <> 'retire' order by nom`)]);
  if (!c) notFound();
  // Doublons possibles : les autres vins du même producteur, et ceux du même nom chez un autre producteur.
  const sans = (x: string) => `translate(lower(${x}), 'àâäáéèêëíîïóôöúùûüç-''', 'aaaaeeeeiiiooouuuuc  ')`;
  const doublons = await requete<{ id: string; nom: string; producteur: string; couleur: string | null; statut: string; cartes: number }>(
    `select k.id, k.nom, p.nom as producteur, k.couleur::text, k.statut::text,
            (select count(distinct v.restaurant_id) from vin_carte v where v.cuvee_id = k.id)::int as cartes
       from cuvee k join producteur p on p.id = k.producteur_id
      where k.id <> $1 and k.statut <> 'retire'
        and (k.producteur_id = $2 or ${sans('k.nom')} = ${sans('$3')})
      order by ${sans('k.nom')} = ${sans('$3')} desc, k.nom limit 200`, [c.id, c.producteur_id, c.nom]);
  // Liste d'où l'on vient (filtres et page) : on y revient après une validation ou un retrait.
  const retour = sp.retour?.startsWith('/admin/super/vins') ? sp.retour : '/admin/super/vins';

  return (
    <>
      <Entete titre={c.nom} texte={[c.producteur, c.appellation].filter(Boolean).join(' · ')}>
        <Link href={retour} className="btn sec">← Vins de la base</Link>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      <form action={enregistrerCuvee.bind(null, c.id)} className="fiche-vin">
        <input type="hidden" name="retour" value={retour} />
        <section className="pile" style={{ gap: 16, minWidth: 0 }}>
          <div className="carte-bo pile">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h2>Fiche</h2>
              <Etat type={STATUT[c.statut]?.[1] ?? ''}>{STATUT[c.statut]?.[0] ?? c.statut}</Etat>
            </div>
            <div className="champs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
              <div className="champ"><label htmlFor="nom">Nom du vin</label><input id="nom" name="nom" defaultValue={c.nom} required /></div>
              <div className="champ"><label htmlFor="producteur">Producteur</label>
                <input id="producteur" name="producteur" list="producteurs-base" defaultValue={c.producteur} required autoComplete="off" />
                <datalist id="producteurs-base">{producteurs.map((p) => <option key={p.nom} value={p.nom}>{p.lieu ?? ''}</option>)}</datalist>
                <span className="aide">Choisissez un autre producteur de la liste pour y rattacher ce vin (et ses vins sur les cartes). <Link href={`/admin/super/producteurs/${encodeURIComponent(c.producteur_id)}`}>Fiche du producteur</Link>{c.producteur_statut !== 'valide' && ' (à valider)'}</span></div>
              <div className="champ"><label htmlFor="couleur">Couleur</label>
                <select id="couleur" name="couleur" defaultValue={c.couleur ?? ''}><option value="">À préciser</option>{COULEURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div className="champ"><label htmlFor="appellation">Appellation</label>
                <input id="appellation" name="appellation" list="appellations-base" defaultValue={c.appellation ?? ''} placeholder="Ex. Chablis" autoComplete="off" />
                <datalist id="appellations-base">{appellations.map((a) => <option key={a.nom} value={a.nom} />)}</datalist>
                <span className="aide">{c.appellation_base ? `Reliée à « ${c.appellation_base} » dans la base de Pat.` : c.appellation ? 'Pas reliée : aucune appellation de ce nom dans la base de Pat (choisissez-en une dans la liste pour la relier).' : 'Choisissez dans la liste pour la relier à la base de Pat.'}</span></div>
              <div className="champ"><label htmlFor="cepages">Cépages</label><input id="cepages" name="cepages" defaultValue={c.cepages ?? ''} /></div>
              <div className="champ interne"><label htmlFor="ranking_vin">Note du vin (cuisine interne, 0 à 5)</label>
                <input id="ranking_vin" name="ranking_vin" type="number" min={0} max={5} step={1} defaultValue={c.ranking_pat ?? ''} placeholder={c.ranking_producteur !== null ? String(c.ranking_producteur) : ''} />
                <span className="aide">Vide : la note du producteur ({c.ranking_producteur ?? 'pas encore notée'}) s’applique. Reprise automatiquement par les restaurants.</span></div>
              <div className="champ"><label htmlFor="garde">Garde</label><input id="garde" name="garde" defaultValue={c.garde ?? ''} placeholder="Ex. 5 à 10 ans" /></div>
            </div>
            <div className="champ"><label htmlFor="description">Description</label><textarea id="description" name="description" rows={5} defaultValue={c.description ?? ''} /></div>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr', gap: '6px 14px', fontSize: 14 }}>
              {c.texte_origine && <><dt style={{ fontWeight: 700 }}>Texte d’origine</dt><dd style={{ margin: 0 }}>{c.texte_origine}</dd></>}
              {c.source && <><dt style={{ fontWeight: 700 }}>Source</dt><dd style={{ margin: 0 }}>{c.source}</dd></>}
            </dl>
          </div>

          <div className="pile" style={{ gap: 10 }}>
            <h2>Sur les cartes des restaurants</h2>
            {c.vins.length ? (
              <div className="tableau"><table style={{ minWidth: 520 }}>
                <thead><tr><th>Restaurant</th><th>Vin sur la carte</th><th>Millésime</th><th className="droite">Prix</th><th>Étiquette</th><th /></tr></thead>
                <tbody>{c.vins.map((v) => (
                  <tr key={v.id}>
                    <td>{v.restaurant}</td>
                    <td><div className="vin-cell"><Vignette url={v.etiquette_url} taille={40} /><div><b>{v.libelle}</b><div className="petit discret">{v.id}{v.format !== '75 cl' ? ` · ${v.format}` : ''}</div></div></div></td>
                    <td>{v.millesime ?? '—'}</td>
                    <td className="droite" style={{ whiteSpace: 'nowrap' }}>{v.prix ? euros(v.prix) : '—'}</td>
                    <td className="col-etiquette">{(() => { const [l, k] = etatEtiquetteVin(v, true); return <Etat type={k}>{l}</Etat>; })()}
                      {v.etiquette_statut === 'echec' && v.etiquette_erreur && <div className="petit discret">{v.etiquette_erreur.slice(0, 120)}</div>}</td>
                    <td className="droite"><Link className="lien-ligne" href={`/admin/${v.restaurant_id}/carte/${encodeURIComponent(v.id)}?${new URLSearchParams({ retour: `/admin/super/vins/${encodeURIComponent(c.id)}?${new URLSearchParams({ retour })}` })}`}>Ouvrir</Link></td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="discret" style={{ margin: 0 }}>Ce vin n’est sur aucune carte pour l’instant.</p>}
          </div>

          {doublons.length > 0 && c.statut !== 'retire' && (
            <div className="carte-bo pile" style={{ gap: 10 }}>
              <h2>Doublon ?</h2>
              <p className="discret" style={{ margin: 0 }}>Si ce vin existe déjà dans la base, fusionnez-le dans celui à garder : ses vins sur les cartes y seront reliés,
                le vin gardé reprend ce qui lui manque (étiquette, appellation, cépages…), et celui-ci est retiré de la base.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                <div className="champ" style={{ flex: '1 1 320px' }}><label htmlFor="cible">Vin à garder</label>
                  <select id="cible" name="cible" form="fusion" defaultValue="" required>
                    <option value="" disabled>Choisir…</option>
                    {doublons.map((d) => <option key={d.id} value={d.id}>{d.nom} — {d.producteur}{d.couleur ? ` · ${COULEURS.find(([k]) => k === d.couleur)?.[1] ?? d.couleur}` : ''} · {STATUT[d.statut]?.[0] ?? d.statut} · {d.cartes} carte{d.cartes > 1 ? 's' : ''}</option>)}
                  </select></div>
                <button className="btn sec" form="fusion">Fusionner</button>
              </div>
            </div>
          )}

          <div className="ligne-actions">
            {c.statut !== 'retire' && <button className="btn sec" name="decision" value="retirer" formNoValidate>Retirer de la base</button>}
            <button className="btn sec" name="decision" value="enregistrer">Enregistrer</button>
            {c.statut !== 'valide' && <button className="btn" name="decision" value="valider">Valider le vin</button>}
          </div>
        </section>
        <aside className="pile" style={{ gap: 16, minWidth: 0 }}>
          <PhotoEtiquette key={c.etiquette_url ?? 'sans'} url={c.etiquette_url}>
            <span className="libelle">Étiquette de la base</span>
            {(() => { const [l, k] = etatEtiquetteBase({ ...c, statuts_cartes: c.vins.map((v) => v.etiquette_statut).filter((s): s is string => Boolean(s)) }); return <Etat type={k}>{l}</Etat>; })()}
            <span className="petit discret">Reprise par les vins des cartes qui n’ont pas leur propre photo.</span>
            {c.etiquette_url && <label className="case" style={{ margin: 0 }}><input type="checkbox" name="retirer_etiquette" /><span>Retirer l’étiquette</span></label>}
          </PhotoEtiquette>
        </aside>
      </form>
      <FormulaireFusion action={fusionnerCuvee.bind(null, c.id)} retour={retour} />
    </>
  );
}
