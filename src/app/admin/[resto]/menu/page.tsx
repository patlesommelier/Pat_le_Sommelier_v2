import Link from 'next/link';
import { enregistrerPlat } from '../../actions';
import { Entete, Etat, Message, euros } from '@/components/admin/Ui';
import { getPlatsBO, getProfil } from '@/lib/admin/donnees';

const CATS = [['tous', 'Tous'], ['entree', 'Entrées'], ['plat', 'Plats'], ['dessert', 'Desserts'], ['fromage', 'Fromages']] as const;

export default async function Menu({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ cat?: string; plat?: string; ok?: string }> }) {
  const { resto } = await params;
  const { cat = 'tous', plat: platId, ok } = await searchParams;
  const plats = await getPlatsBO(resto);
  const affiches = plats.filter((p) => cat === 'tous' || p.categorie === cat);
  const choisi = plats.find((p) => p.id === platId) ?? affiches[0];
  const profil = choisi ? await getProfil(choisi.id) : null;
  const lien = (q: Record<string, string>) => `/admin/${resto}/menu?${new URLSearchParams({ cat, ...(choisi ? { plat: choisi.id } : {}), ...q })}`;
  return (
    <>
      <Entete titre="Menu" texte="Les plats proposés à vos clients : nom, nom court affiché sur l’accueil, catégorie et prix. Un plat masqué n’apparaît plus dans l’app." />
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
                    <td><div className="nom">{p.nom}</div><div className="petit">Accueil : {p.nom_court ?? p.nom}</div></td>
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
