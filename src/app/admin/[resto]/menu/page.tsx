import Link from 'next/link';
import { enregistrerPlat } from '../../actions';
import { Entete, Etat, Message, euros } from '@/components/admin/Ui';
import { getPlatsBO, getProfil } from '@/lib/admin/donnees';
import { exigerAcces, utilisateurCourant } from '@/lib/admin/auth';
import { RelirePrix } from '@/components/admin/RelirePrix';
import { requete } from '@/lib/db';

const CATS = [['tous', 'Tous'], ['entree', 'Entrées'], ['plat', 'Plats'], ['dessert', 'Desserts'], ['fromage', 'Fromages']] as const;

export default async function Menu({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ cat?: string; plat?: string; ok?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { cat = 'tous', plat: platId, ok } = await searchParams;
  const [plats, u] = await Promise.all([getPlatsBO(resto), utilisateurCourant()]);
  // Relecture des prix sur le menu : super-admin seulement (chaque lecture est un appel à Claude payé par Pat).
  const [derniere] = u?.admin ? await requete<{ statut: string; message: string | null; le: string }>(
    `select statut, message, maj_le::text as le from relecture_prix where restaurant_id = $1 order by cree_le desc limit 1`, [resto]) : [];
  const affiches = plats.filter((p) => cat === 'tous' || p.categorie === cat);
  const choisi = plats.find((p) => p.id === platId) ?? affiches[0];
  const profil = choisi ? await getProfil(choisi.id) : null;
  const lien = (q: Record<string, string>) => `/admin/${resto}/menu?${new URLSearchParams({ cat, ...(choisi ? { plat: choisi.id } : {}), ...q })}`;
  return (
    <>
      <Entete titre="Menu" texte="Les plats proposés à vos clients : nom, nom court affiché sur l’accueil, catégorie et prix. Un plat masqué n’apparaît plus dans l’app." />
      {u?.admin && <RelirePrix resto={resto} derniere={derniere ?? null} />}
      <div className="rangee">
        <section className="large">
          <nav className="onglets" aria-label="Catégories">
            {CATS.map(([k, l]) => (
              <Link key={k} href={lien({ cat: k })} aria-current={cat === k ? 'true' : undefined}>{l} <span>{k === 'tous' ? plats.length : plats.filter((p) => p.categorie === k).length}</span></Link>
            ))}
          </nav>
          <div className="tableau">
            <table style={{ minWidth: 640 }}>
              <thead><tr><th>Plat</th><th className="droite">Prix</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {affiches.map((p) => (
                  <tr key={p.id} className={p.id === choisi?.id ? 'choisi' : ''}>
                    <td><div className="nom">{p.nom}</div><div className="petit">Accueil : {p.nom_court ?? p.nom}{p.description_cuisine ? ' · description détaillée' : ''}</div></td>
                    <td className="droite" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{p.prix_variantes ?? euros(p.prix)}</td>
                    <td>{!p.actif ? <Etat type="defaut">Masqué</Etat> : p.modifie_bo ? <Etat type="ok">Modifié</Etat> : <Etat type="ok">En ligne</Etat>}</td>
                    <td className="droite"><Link className="lien-ligne" href={lien({ plat: p.id })} aria-label={`Modifier ${p.nom}`}>Modifier</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {choisi && (
          <aside className="etroit">
            <form key={choisi.id} action={enregistrerPlat.bind(null, resto, choisi.id)} className="carte-bo pile" id="detail">
              <h2>{choisi.nom_court ?? choisi.nom}</h2>
              <Message ok={ok ? 'Enregistré.' : undefined} />
              <div className="champ"><label htmlFor="nom">Nom sur le menu</label><textarea id="nom" name="nom" rows={2} defaultValue={choisi.nom} /></div>
              <div className="champ"><label htmlFor="nom_court">Nom court (bouton de l’accueil client)</label><input id="nom_court" name="nom_court" defaultValue={choisi.nom_court ?? ''} maxLength={28} /></div>
              <div className="champs">
                <div className="champ"><label htmlFor="categorie">Catégorie</label>
                  <select id="categorie" name="categorie" defaultValue={choisi.categorie}>
                    <option value="entree">Entrée</option><option value="plat">Plat</option><option value="dessert">Dessert</option><option value="fromage">Fromage</option>
                  </select></div>
                <div className="champ"><label htmlFor="prix">Prix (€)</label><input id="prix" name="prix" inputMode="decimal" defaultValue={choisi.prix ?? ''} /></div>
              </div>
              <div className="champ"><label htmlFor="prix_variantes">Prix détaillé (facultatif)</label><input id="prix_variantes" name="prix_variantes" defaultValue={choisi.prix_variantes ?? ''} placeholder="1 pièce 12 € / 2 pièces 22 €" /></div>
              <label className="case"><input type="checkbox" name="actif" defaultChecked={choisi.actif} /><span>Proposé aux clients</span></label>
              <div className="champ">
                <label htmlFor="description_cuisine">Description pour Pat</label>
                <textarea id="description_cuisine" name="description_cuisine" rows={7} defaultValue={choisi.description_cuisine ?? ''}
                  placeholder={'Cuisson (rôti, poché, frit, grillé, mijoté…), degré de cuisson, tous les ingrédients, épices et herbes, sauce et sa base (beurre, crème, vin, jus…), garniture, assaisonnement, piquant, acidité, sucre, textures, origine des produits…'} />
                <span className="aide">Tout ce qui aide Pat à faire un accord plus précis. Non montré aux clients.</span>
              </div>
              <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, marginBottom: 6 }}>Sauce servie à part</legend>
                {([['oui', 'Oui', 'servie à côté, comme un condiment : elle ne dicte pas l’accord'], ['non', 'Non', 'nappée ou composante du plat : elle compte dans l’accord'],
                  ['', 'Je ne sais pas', '']] as const).map(([v, l, aide]) => (
                  <label key={v || 'nsp'} className="case">
                    <input type="radio" name="sauce" value={v}
                      defaultChecked={(choisi.sauce_servie_a_part === true && v === 'oui') || (choisi.sauce_servie_a_part === false && v === 'non') || (choisi.sauce_servie_a_part === null && v === '')} />
                    <span>{l}{aide && <small>{aide}</small>}</span>
                  </label>
                ))}
              </fieldset>
              {choisi.description_apres_accords && (
                <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Description modifiée après le calcul des accords de ce plat : Pat en tiendra compte au prochain calcul.</p>
              )}
              {profil && (
                <div className="encadre-rose" style={{ flexDirection: 'column', gap: 8 }}>
                  <span className="surtitre" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/pat/pat.png" alt="" width={22} height={24} />Profil d’accord préparé par Pat</span>
                  <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '84px 1fr', gap: '6px 12px' }}>
                    {profil.ancrages?.length ? <><dt style={{ fontWeight: 700 }}>Ancrages</dt><dd style={{ margin: 0 }}>{profil.ancrages.join(', ')}</dd></> : null}
                    {profil.profil && <><dt style={{ fontWeight: 700 }}>Profil</dt><dd style={{ margin: 0 }}>{profil.profil}</dd></>}
                    {profil.a_eviter && <><dt style={{ fontWeight: 700 }}>À éviter</dt><dd style={{ margin: 0 }}>{profil.a_eviter}</dd></>}
                    {profil.temperature_service && <><dt style={{ fontWeight: 700 }}>Service</dt><dd style={{ margin: 0 }}>{profil.temperature_service}</dd></>}
                  </dl>
                </div>
              )}
              <div className="ligne-actions">
                <button type="submit" className="btn petit">Enregistrer</button>
                <Link href={`/admin/${resto}/accords?plat=${choisi.id}`} className="btn sec petit">Voir ses accords</Link>
              </div>
            </form>
          </aside>
        )}
      </div>
    </>
  );
}
