// Ajout d'un plat par le restaurant. Pat prépare ensuite ses accords avec toute la carte des vins.
import Link from 'next/link';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { ajouterPlat } from '../../../actions';
import { exigerAcces } from '@/lib/admin/auth';

export default async function NouveauPlat({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ cat?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { cat } = await searchParams;
  return (
    <>
      <Link href={`/admin/${resto}/menu`} className="lien-ligne" style={{ minHeight: 0, marginBottom: -8 }}>← Menu</Link>
      <header className="bo-entete"><div><h1>Ajouter un plat</h1>
        <p>Une fois le plat ajouté, Pat prépare ses accords avec toute votre carte des vins : comptez quelques minutes.</p></div></header>
      <FormulaireAdmin action={ajouterPlat.bind(null, resto)} className="carte-bo pile" style={{ maxWidth: 720 }}>
        <div className="champ"><label htmlFor="nom">Nom sur le menu</label><textarea id="nom" name="nom" rows={2} required /></div>
        <div className="champ"><label htmlFor="nom_court">Nom court (bouton de l’accueil client, facultatif)</label><input id="nom_court" name="nom_court" maxLength={28} /></div>
        <div className="champs">
          <div className="champ"><label htmlFor="categorie">Catégorie</label>
            <select id="categorie" name="categorie" defaultValue={['entree', 'plat', 'dessert', 'fromage'].includes(cat ?? '') ? cat : 'plat'}>
              <option value="entree">Entrée</option><option value="plat">Plat</option><option value="dessert">Dessert</option><option value="fromage">Fromage</option>
            </select></div>
          <div className="champ"><label htmlFor="prix">Prix (€)</label><input id="prix" name="prix" inputMode="decimal" /></div>
        </div>
        <div className="champ"><label htmlFor="prix_variantes">Prix détaillé (facultatif)</label><input id="prix_variantes" name="prix_variantes" placeholder="1 pièce 12 € / 2 pièces 22 €" /></div>
        <div className="champ">
          <label htmlFor="description_cuisine">Description pour Pat</label>
          <textarea id="description_cuisine" name="description_cuisine" rows={6}
            placeholder={'Cuisson (rôti, poché, frit, grillé, mijoté…), degré de cuisson, tous les ingrédients, épices et herbes, sauce et sa base (beurre, crème, vin, jus…), garniture, assaisonnement, piquant, acidité, sucre, textures, origine des produits…'} />
          <span className="aide">Plus elle est précise, meilleurs sont les accords. Non montrée aux clients.</span>
        </div>
        <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, marginBottom: 6 }}>Sauce servie à part</legend>
          {([['oui', 'Oui', 'servie à côté, comme un condiment : elle ne dicte pas l’accord'], ['non', 'Non', 'nappée ou composante du plat : elle compte dans l’accord'],
            ['', 'Je ne sais pas', '']] as const).map(([v, l, aide]) => (
            <label key={v || 'nsp'} className="case"><input type="radio" name="sauce" value={v} defaultChecked={v === ''} /><span>{l}{aide && <small>{aide}</small>}</span></label>
          ))}
        </fieldset>
        <div className="ligne-actions"><button type="submit" className="btn">Ajouter ce plat</button></div>
      </FormulaireAdmin>
    </>
  );
}
