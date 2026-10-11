import Link from 'next/link';
import { notFound } from 'next/navigation';
import { enregistrerCuvee } from '../../actions';
import { Entete, Etat, Message, Vignette, euros } from '@/components/admin/Ui';
import { PhotoEtiquette } from '@/components/admin/PhotoEtiquette';
import { ficheCuvee } from '@/lib/super/donnees';
import { exigerAdmin } from '@/lib/admin/auth';

const COULEURS: [string, string][] = [['bulles', 'Bulles'], ['blanc', 'Blanc'], ['rose', 'Rosé'], ['rouge', 'Rouge'], ['orange', 'Orange'], ['doux', 'Doux']];
const STATUT: Record<string, [string, 'ok' | 'propose' | 'defaut']> = { valide: ['Validé', 'ok'], propose: ['À valider', 'propose'], retire: ['Retiré', 'defaut'] };

/** Fiche d'un vin de la base de Pat : informations, étiquette, vins des cartes reliés ; Enregistrer / Valider / Retirer. */
export default async function FicheVinBase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string; retour?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { id } = await params;
  const sp = await searchParams;
  const c = await ficheCuvee(decodeURIComponent(id));
  if (!c) notFound();
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
              <div className="champ"><label htmlFor="couleur">Couleur</label>
                <select id="couleur" name="couleur" defaultValue={c.couleur ?? ''}><option value="">À préciser</option>{COULEURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div className="champ"><label htmlFor="appellation">Appellation</label><input id="appellation" name="appellation" defaultValue={c.appellation ?? ''} placeholder="Ex. Chablis" />
                <span className="aide">Reliée à l’appellation du même nom dans la base de Pat.</span></div>
              <div className="champ"><label htmlFor="cepages">Cépages</label><input id="cepages" name="cepages" defaultValue={c.cepages ?? ''} /></div>
              <div className="champ"><label htmlFor="garde">Garde</label><input id="garde" name="garde" defaultValue={c.garde ?? ''} placeholder="Ex. 5 à 10 ans" /></div>
            </div>
            <div className="champ"><label htmlFor="description">Description</label><textarea id="description" name="description" rows={5} defaultValue={c.description ?? ''} /></div>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr', gap: '6px 14px', fontSize: 14 }}>
              <dt style={{ fontWeight: 700 }}>Producteur</dt>
              <dd style={{ margin: 0 }}><Link href={`/admin/super/producteurs/${encodeURIComponent(c.producteur_id)}`}>{c.producteur}</Link>{c.producteur_statut !== 'valide' && ' (à valider)'}</dd>
              {c.texte_origine && <><dt style={{ fontWeight: 700 }}>Texte d’origine</dt><dd style={{ margin: 0 }}>{c.texte_origine}</dd></>}
              {c.source && <><dt style={{ fontWeight: 700 }}>Source</dt><dd style={{ margin: 0 }}>{c.source}</dd></>}
            </dl>
          </div>

          <div className="pile" style={{ gap: 10 }}>
            <h2>Sur les cartes des restaurants</h2>
            {c.vins.length ? (
              <div className="tableau"><table style={{ minWidth: 520 }}>
                <thead><tr><th>Restaurant</th><th>Vin sur la carte</th><th>Millésime</th><th className="droite">Prix</th><th /></tr></thead>
                <tbody>{c.vins.map((v) => (
                  <tr key={v.id}>
                    <td>{v.restaurant}</td>
                    <td><div className="vin-cell"><Vignette url={v.etiquette_url} taille={40} /><div><b>{v.libelle}</b><div className="petit discret">{v.id}{v.format !== '75 cl' ? ` · ${v.format}` : ''}</div></div></div></td>
                    <td>{v.millesime ?? '—'}</td>
                    <td className="droite" style={{ whiteSpace: 'nowrap' }}>{v.prix ? euros(v.prix) : '—'}</td>
                    <td className="droite"><Link className="lien-ligne" href={`/admin/${v.restaurant_id}/carte/${encodeURIComponent(v.id)}`}>Ouvrir</Link></td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="discret" style={{ margin: 0 }}>Ce vin n’est sur aucune carte pour l’instant.</p>}
          </div>

          <div className="ligne-actions">
            {c.statut !== 'retire' && <button className="btn sec" name="decision" value="retirer" formNoValidate>Retirer de la base</button>}
            <button className="btn sec" name="decision" value="enregistrer">Enregistrer</button>
            {c.statut !== 'valide' && <button className="btn" name="decision" value="valider">Valider le vin</button>}
          </div>
        </section>
        <aside className="pile" style={{ gap: 16, minWidth: 0 }}>
          <PhotoEtiquette key={c.etiquette_url ?? 'sans'} url={c.etiquette_url}>
            <span className="libelle">Étiquette de la base</span>
            <span className="petit discret">Reprise par les vins des cartes qui n’ont pas leur propre photo.</span>
            {c.etiquette_url && <label className="case" style={{ margin: 0 }}><input type="checkbox" name="retirer_etiquette" /><span>Retirer l’étiquette</span></label>}
          </PhotoEtiquette>
        </aside>
      </form>
    </>
  );
}
