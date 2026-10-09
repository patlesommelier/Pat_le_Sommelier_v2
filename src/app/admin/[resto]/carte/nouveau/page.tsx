// Ajout d'un vin par le restaurant : mêmes champs que la fiche du vin. Pat prépare ensuite ses accords avec chaque plat.
import Link from 'next/link';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { PhotoEtiquette } from '@/components/admin/PhotoEtiquette';
import { IntituleVin } from '@/components/admin/IntituleVin';
import { ajouterVin } from '../../../actions';
import { exigerAcces } from '@/lib/admin/auth';
import { CONTENANCES } from '@/lib/contenances';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blanc'], ['rose', 'Rosé'], ['rouge', 'Rouge'], ['orange', 'Orange'], ['doux', 'Doux']] as const;
const cadre = { gap: 12, border: '1px solid var(--ligne)', borderRadius: 14, padding: 16, margin: 0 } as const;
const legende = { fontSize: 13, fontWeight: 700, padding: '0 6px' } as const;

export default async function NouveauVin({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { c } = await searchParams;
  const couleur = COULEURS.some(([k]) => k === c) ? c : 'rouge';
  return (
    <>
      <Link href={`/admin/${resto}/carte${c ? `?c=${c}` : ''}`} className="lien-ligne" style={{ minHeight: 0, marginBottom: -8 }}>← Carte des vins</Link>
      <header className="bo-entete"><div><h1>Ajouter un vin</h1>
        <p>Une fois le vin ajouté, Pat prépare ses accords avec chacun de vos plats et sa présentation : comptez quelques minutes.</p></div></header>

      <FormulaireAdmin action={ajouterVin.bind(null, resto)} className="fiche-vin">
        <section className="pile" style={{ gap: 16, minWidth: 0 }}>
          <fieldset className="carte-bo pile" style={cadre}>
            <legend style={legende}>Le vin</legend>
            <div className="champs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
              <div className="champ"><label htmlFor="couleur">Couleur</label>
                <select id="couleur" name="couleur" defaultValue={couleur}>{COULEURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div className="champ"><label htmlFor="section">Région (titre de la carte)</label><input id="section" name="section" placeholder="Ex. Bourgogne" /></div>
            </div>
            <IntituleVin initial="" />
            <div className="champs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
              <div className="champ"><label htmlFor="appellation_texte">Appellation</label><input id="appellation_texte" name="appellation_texte" placeholder="Ex. Chablis" /></div>
              <div className="champ"><label htmlFor="nom_vin">Nom du vin</label><input id="nom_vin" name="nom_vin" placeholder="Ex. Saint-Pierre (laisser vide s’il n’en a pas)" /></div>
              <div className="champ"><label htmlFor="cepages">Cépage(s)</label><input id="cepages" name="cepages" placeholder="Ex. Chardonnay" /></div>
              <div className="champ"><label htmlFor="producteur_texte">Producteur</label><input id="producteur_texte" name="producteur_texte" placeholder="Nom du domaine ou de la maison" /></div>
            </div>
          </fieldset>

          <fieldset className="carte-bo pile" style={cadre}>
            <legend style={legende}>Contenances, millésime et prix</legend>
            <input type="hidden" name="disponible" value="on" />
            <div className="pile" style={{ gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Contenances disponibles et prix</span>
              {CONTENANCES.filter((x) => x.code !== 'magnum').map((x) => (
                <div key={x.code} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label className="case" style={{ margin: 0, width: 150 }}><input type="checkbox" name="contenances" value={x.code} defaultChecked={x.code === 'bouteille'} /><span>{x.libelle}</span></label>
                  <div className="champ" style={{ margin: 0, width: 120 }}>
                    <input name={`prix_${x.code}`} inputMode="decimal" aria-label={`Prix ${x.libelle.toLowerCase()} (€)`} placeholder="Prix" />
                  </div>
                  <span className="discret">€{x.code === 'verre' ? ' le verre' : ''}</span>
                </div>
              ))}
            </div>
            <div className="champ" style={{ maxWidth: 240 }}><label htmlFor="millesime">Millésime</label><input id="millesime" name="millesime" placeholder="Ex. 2021 (vide si non millésimé)" /></div>
          </fieldset>

          <div className="ligne-actions">
            <button type="submit" className="btn">Ajouter ce vin</button>
          </div>
        </section>
        <aside className="pile" style={{ gap: 16, minWidth: 0 }}>
          <PhotoEtiquette url={null}>
            <span className="libelle">Photo de l’étiquette (facultatif)</span>
            <span className="petit discret">Sans photo, Pat la cherche dans sa base.</span>
          </PhotoEtiquette>
        </aside>
      </FormulaireAdmin>
    </>
  );
}
