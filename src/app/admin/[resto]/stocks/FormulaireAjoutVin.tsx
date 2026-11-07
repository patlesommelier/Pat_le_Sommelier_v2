// Ajout d'un vin, dans la fenêtre de la Base de vins : choisir le vin (recherche, catalogue d'un distributeur, ou description libre),
// puis millésime, contenances et prix de vente. La description du vin (remplie par le vin choisi) reste modifiable, repliée.
// Pat prépare ensuite ses accords avec chaque plat.
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { PhotoEtiquette } from '@/components/admin/PhotoEtiquette';
import { IntituleVin } from '@/components/admin/IntituleVin';
import { ChoixVin } from '@/components/admin/ChoixVin';
import { distributeursProposes } from '@/lib/distributeurs/donnees';
import { ajouterVin, catalogueAjout, chercherDansBase } from '../../actions';
import { CONTENANCES } from '@/lib/contenances';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blanc'], ['rose', 'Rosé'], ['rouge', 'Rouge'], ['orange', 'Orange'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']] as const;
const cadre = { gap: 12, border: '1px solid var(--ligne)', borderRadius: 14, padding: 16, margin: 0 } as const;
const legende = { fontSize: 13, fontWeight: 700, padding: '0 6px' } as const;

/** `manuel` : vin décrit à la main (pas de recherche) ; la fiche est ouverte et le vin sera « En attente de validation ». */
export async function FormulaireAjoutVin({ resto, couleur: c, manuel = false }: { resto: string; couleur?: string; manuel?: boolean }) {
  const couleur = COULEURS.some(([k]) => k === c) ? c : 'rouge';
  // Seulement les distributeurs que le restaurant a choisis (actifs dans sa page Distributeurs).
  const distributeurs = (await distributeursProposes(resto)).filter((d) => d.deja).map((d) => ({ id: d.id, nom: d.nom, vins: d.vins }));
  return (
    <FormulaireAdmin action={ajouterVin.bind(null, resto)} className="pile" style={{ gap: 16 }}>
      {!manuel && (
        <fieldset className="carte-bo pile" style={{ ...cadre, border: '1.5px solid var(--encre)' }}>
          <legend style={legende}>1. Le vin</legend>
          <ChoixVin chercher={chercherDansBase.bind(null, resto)} distributeurs={distributeurs} charger={catalogueAjout.bind(null, resto)} />
        </fieldset>
      )}

      <details id="description-vin" className="carte-bo" style={{ ...cadre, padding: '12px 16px', ...(manuel ? { border: '1.5px solid var(--encre)' } : {}) }} open={manuel}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{manuel ? '1. Le vin' : 'Description du vin'} <span className="discret" style={{ fontWeight: 400 }}>{manuel ? '(couleur, appellation, producteur, photo…)' : '(couleur, appellation, producteur, photo… remplis par le vin choisi)'}</span></summary>
        <div className="pile" style={{ gap: 12, marginTop: 12 }}>
          <div className="champs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
            <div className="champ"><label htmlFor="couleur">Couleur</label>
              <select id="couleur" name="couleur" defaultValue={couleur}>{COULEURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="champ"><label htmlFor="section">Région (titre de la carte)</label><input id="section" name="section" placeholder="Ex. Bourgogne" /></div>
          </div>
          <IntituleVin initial="" />
          <div className="champs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
            <div className="champ"><label htmlFor="appellation_texte">Appellation</label><input id="appellation_texte" name="appellation_texte" placeholder="Ex. Chablis" /></div>
            <div className="champ"><label htmlFor="nom_vin">Nom du vin</label><input id="nom_vin" name="nom_vin" placeholder="Ex. Saint-Pierre (vide s’il n’en a pas)" /></div>
            <div className="champ"><label htmlFor="cepages">Cépage(s)</label><input id="cepages" name="cepages" placeholder="Ex. Chardonnay" /></div>
            <div className="champ"><label htmlFor="producteur_texte">Producteur</label><input id="producteur_texte" name="producteur_texte" placeholder="Nom du domaine ou de la maison" /></div>
          </div>
          <PhotoEtiquette url={null} base hauteur={200}>
            <span className="libelle">Photo de l’étiquette (facultatif)</span>
            <span className="petit discret">Sans photo, elle est cherchée dans la base Quid Vinum.</span>
          </PhotoEtiquette>
        </div>
      </details>

      <fieldset className="carte-bo pile" style={cadre}>
        <legend style={legende}>2. Millésime et prix de vente TVAC sur votre carte</legend>
        <input type="hidden" name="disponible" value="on" />
        <div className="champ" style={{ maxWidth: 220, margin: 0 }}><label htmlFor="millesime">Millésime</label><input id="millesime" name="millesime" placeholder="Ex. 2021 (vide si non millésimé)" /></div>
        <div className="pile" style={{ gap: 8 }}>
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
      </fieldset>

      <div className="ligne-actions">
        <button type="submit" className="btn">Ajouter ce vin</button>
        <span className="petit discret">Pat prépare ensuite ses accords avec vos plats (quelques minutes).</span>
      </div>
    </FormulaireAdmin>
  );
}
