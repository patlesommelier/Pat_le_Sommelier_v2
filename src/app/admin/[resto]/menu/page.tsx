import Link from 'next/link';
import { FormulaireAdmin } from '@/components/admin/FormulaireAdmin';
import { enregistrerPlat, envoyerSuggestions, supprimerPlat } from '../../actions';
import { EnvoiSuggestions, type EtatLecture } from '@/components/admin/EnvoiSuggestions';
import { BoutonSupprimer } from '@/components/admin/BoutonSupprimer';
import { PhotoEtiquette } from '@/components/admin/PhotoEtiquette';
import { Entete, Etat, Message, euros } from '@/components/admin/Ui';
import { getPlatsBO, getProfils, type PlatBO } from '@/lib/admin/donnees';

type Profil = NonNullable<ReturnType<Awaited<ReturnType<typeof getProfils>>['get']>>;
import { exigerAcces, utilisateurCourant } from '@/lib/admin/auth';
import { RelirePrix } from '@/components/admin/RelirePrix';
import { requete } from '@/lib/db';

const CATS = [['tous', 'Tous'], ['suggestion', 'Suggestions'], ['entree', 'Entrées'], ['plat', 'Plats'], ['dessert', 'Desserts'], ['fromage', 'Fromages']] as const;

export default async function Menu({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ cat?: string; plat?: string; ok?: string; ajout?: string; supprime?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const { cat = 'tous', plat: platId, ok, ajout, supprime } = await searchParams;
  const [plats, u, profils] = await Promise.all([getPlatsBO(resto), utilisateurCourant(), getProfils(resto)]);
  // Relecture des prix sur le menu : super-admin seulement (chaque lecture est un appel à Claude payé par Pat).
  const [derniere] = u?.admin ? await requete<{ statut: string; message: string | null; le: string }>(
    `select statut, message, maj_le::text as le from relecture_prix where restaurant_id = $1 order by cree_le desc limit 1`, [resto]) : [];
  // Dernière lecture de suggestions (photo envoyée par le restaurant), récente seulement (moins d'un jour).
  const [lecture] = await requete<NonNullable<EtatLecture>>(
    `select statut, message, maj_le::text as le from lecture_suggestions where restaurant_id = $1 and cree_le > now() - interval '1 day' order by cree_le desc limit 1`, [resto]);
  const affiches = plats.filter((p) => cat === 'tous' || p.categorie === cat);
  const lien = (q: Record<string, string>) => `/admin/${resto}/menu?${new URLSearchParams({ cat, ...q })}`;
  return (
    <>
      <Entete titre="Menu" texte="Les plats proposés à vos clients : nom, nom court affiché sur l’accueil, catégorie et prix. Un plat masqué n’apparaît plus dans l’app.">
        <Link href={`/admin/${resto}/menu/nouveau${cat !== 'tous' ? `?cat=${cat}` : ''}`} className="btn">Ajouter un plat</Link>
      </Entete>
      {supprime && <Message ok={`« ${supprime} » a été supprimé du menu.`} />}
      {ajout && <Message ok="Plat ajouté : Pat prépare ses accords avec votre carte des vins (quelques minutes). Il apparaîtra dans l’app dès qu’ils seront prêts." />}
      {u?.admin && <RelirePrix resto={resto} derniere={derniere ?? null} />}
      <EnvoiSuggestions envoyer={envoyerSuggestions.bind(null, resto)} derniere={lecture ?? null} nombre={plats.filter((p) => p.categorie === 'suggestion' && p.actif).length} />
      <section className="pile">
        <nav className="onglets" aria-label="Catégories">
          {CATS.map(([k, l]) => (
            <Link key={k} href={lien({ cat: k })} aria-current={cat === k ? 'true' : undefined}>{l} <span>{k === 'tous' ? plats.length : plats.filter((p) => p.categorie === k).length}</span></Link>
          ))}
        </nav>
        {/* Chaque plat se déroule (flèche vers le bas) pour afficher et modifier son détail. */}
        <div className="liste-deroulante">
          {affiches.map((p) => (
            <details key={p.id} className="deroulant" open={p.id === platId}>
              <summary>
                <span className="deroulant-nom"><span className="nom">{p.nom}</span>{p.nom_court && p.nom_court !== p.nom && <span className="petit">Nom affiché dans l’app : {p.nom_court}</span>}</span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{p.prix_variantes ?? euros(p.prix)}</span>
                {!p.actif ? <Etat type="defaut">Masqué</Etat> : p.modifie_bo ? <Etat type="ok">Modifié</Etat> : <Etat type="ok">En ligne</Etat>}
                <svg className="fleche" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <DetailPlat resto={resto} plat={p} profil={profils.get(p.id) ?? null} ok={Boolean(ok) && p.id === platId} />
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

/** Détail d'un plat, déroulé sous son nom : tout se modifie ici et s'enregistre sans quitter la liste. */
function DetailPlat({ resto, plat, profil, ok }: { resto: string; plat: PlatBO; profil: Profil | null; ok: boolean }) {
  return (
    <FormulaireAdmin key={plat.id} action={enregistrerPlat.bind(null, resto, plat.id)} className="deroulant-corps">
      <Message ok={ok ? 'Enregistré.' : undefined} />
      <div className="champ"><label htmlFor={`nom-${plat.id}`}>Nom sur le menu</label><textarea id={`nom-${plat.id}`} name="nom" rows={2} defaultValue={plat.nom} /></div>
      <div className="champ"><label htmlFor={`nom_court-${plat.id}`}>Nom court (bouton de l’accueil client)</label><input id={`nom_court-${plat.id}`} name="nom_court" defaultValue={plat.nom_court ?? ''} maxLength={28} /></div>
      <div className="champs">
        <div className="champ"><label htmlFor={`categorie-${plat.id}`}>Catégorie</label>
          <select id={`categorie-${plat.id}`} name="categorie" defaultValue={plat.categorie}>
            <option value="entree">Entrée</option><option value="plat">Plat</option><option value="dessert">Dessert</option><option value="fromage">Fromage</option><option value="suggestion">Suggestion</option>
          </select></div>
        <div className="champ"><label htmlFor={`prix-${plat.id}`}>Prix (€)</label><input id={`prix-${plat.id}`} name="prix" inputMode="decimal" defaultValue={plat.prix ?? ''} /></div>
      </div>
      <div className="champ"><label htmlFor={`prix_variantes-${plat.id}`}>Prix détaillé (facultatif)</label><input id={`prix_variantes-${plat.id}`} name="prix_variantes" defaultValue={plat.prix_variantes ?? ''} placeholder="1 pièce 12 € / 2 pièces 22 €" /></div>
      <label className="case"><input type="checkbox" name="actif" defaultChecked={plat.actif} /><span>Proposé aux clients</span></label>
      {/* Clé = adresse de la photo : après l'enregistrement, l'aperçu laisse place à la photo enregistrée. */}
      <PhotoEtiquette key={plat.photo_url ?? 'sans'} url={plat.photo_url} champ="photo" alt="Photo du plat" hauteur={220}>
        <span className="libelle">Photo du plat (facultative)</span>
        <span className="petit discret">Montrée à vos clients avec les propositions de Pat.</span>
        {plat.photo_url && <label className="case" style={{ margin: 0 }}><input type="checkbox" name="retirer_photo" /><span>Retirer la photo</span></label>}
      </PhotoEtiquette>
      <div className="champ">
        <label htmlFor={`description_cuisine-${plat.id}`}>Description pour Pat</label>
        <textarea id={`description_cuisine-${plat.id}`} name="description_cuisine" rows={7} defaultValue={plat.description_cuisine ?? ''}
          placeholder={'Cuisson (rôti, poché, frit, grillé, mijoté…), degré de cuisson, tous les ingrédients, épices et herbes, sauce et sa base (beurre, crème, vin, jus…), garniture, assaisonnement, piquant, acidité, sucre, textures, origine des produits…'} />
        <span className="aide">Tout ce qui aide Pat à faire un accord plus précis. Non montré aux clients.</span>
      </div>
      <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, marginBottom: 6 }}>Sauce servie à part</legend>
        {([['oui', 'Oui', 'servie à côté, comme un condiment : elle ne dicte pas l’accord'], ['non', 'Non', 'nappée ou composante du plat : elle compte dans l’accord'],
          ['', 'Je ne sais pas', '']] as const).map(([v, l, aide]) => (
          <label key={v || 'nsp'} className="case">
            <input type="radio" name="sauce" value={v}
              defaultChecked={(plat.sauce_servie_a_part === true && v === 'oui') || (plat.sauce_servie_a_part === false && v === 'non') || (plat.sauce_servie_a_part === null && v === '')} />
            <span>{l}{aide && <small>{aide}</small>}</span>
          </label>
        ))}
      </fieldset>
      {plat.description_apres_accords && (
        <p className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)' }}>Description modifiée après le calcul des accords de ce plat : Pat en tiendra compte au prochain calcul.</p>
      )}
      {profil && (
        <div className="encadre-rose" style={{ flexDirection: 'column', gap: 8 }}>
          <span className="surtitre" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pat/pat-avatar.svg" alt="" width={22} height={22} />Profil d’accord préparé par Pat</span>
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
        <Link href={`/admin/${resto}/accords?plat=${plat.id}`} className="btn sec petit">Voir ses accords</Link>
        <BoutonSupprimer action={supprimerPlat.bind(null, resto, plat.id)} libelle="Supprimer ce plat" className="btn sec petit"
          question={`Supprimer « ${plat.nom} » du menu ? Ses accords seront supprimés aussi. Cette action est définitive. (Pour le retirer temporairement, décochez plutôt « Proposé aux clients ».)`} />
      </div>
    </FormulaireAdmin>
  );
}
