// Fiche d'un producteur pour le restaurant (lecture seule) : ce que la base de Quid Vinum dit de lui, ses vins de la base,
// et les vins du restaurant qui viennent de chez lui. Jamais de notes ni de classement (réservés à Pat).
// Seulement pour un producteur dont le restaurant a au moins un vin.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { presentationPublique } from '@/lib/producteurs/presentation';
import { offresDistributeurs } from '@/lib/admin/recherche-base';
import { ajouterDuCatalogue } from '../../../stocks-actions';
import { AjoutCatalogue } from '@/components/admin/Panier';
import { euros } from '@/lib/bon-commande';
import { VignetteVin } from '@/components/admin/VignetteVin';

const PRODUCTION: Record<string, string> = {
  biologique: 'Agriculture biologique', 'biologique-certifie': 'Agriculture biologique certifiée', biodynamie: 'Biodynamie',
  'biodynamie-certifiee': 'Biodynamie certifiée', nature: 'Vins nature', 'conventionnel-raisonne': 'Agriculture raisonnée',
};
const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blanc', rose: 'Rosé', orange: 'Orange', rouge: 'Rouge', doux: 'Doux', sans_alcool: 'Sans alcool' };

export default async function FicheProducteur({ params, searchParams }: { params: Promise<{ resto: string; id: string }>; searchParams: Promise<{ vin?: string; retour?: string }> }) {
  const { resto, id: brut } = await params;
  await exigerAcces(resto);
  const id = decodeURIComponent(brut);
  const { vin, retour } = await searchParams;
  const [[p], cuvees, siens] = await Promise.all([
    requete<{ nom: string; pays: string | null; region: string | null; sous_region: string | null; localisation: string | null; appellations: string[];
      production: string; couleurs: string[]; cepages: string[]; presentation: string | null }>(
      `select nom, pays, region, sous_region, localisation, appellations_texte as appellations, statut_production::text as production,
              couleurs, cepages_rois as cepages, notes_objectives as presentation
         from producteur where id = $1 and statut <> 'retire'`, [id]),
    requete<{ id: string; nom: string; appellation: string | null; couleur: string | null; etiquette: string | null }>(
      `select c.id, c.nom, coalesce(t.nom, c.appellation_texte) as appellation, c.couleur::text as couleur,
              -- Photo : celle de la base, sinon celle d'un distributeur ou d'une carte qui a ce vin.
              coalesce(c.etiquette_url, (select dv.etiquette_url from distributeur_vin dv where dv.cuvee_id = c.id and dv.etiquette_url is not null limit 1),
                       (select vc.etiquette_url from vin_carte vc where vc.cuvee_id = c.id and vc.etiquette_url is not null limit 1)) as etiquette
         from cuvee c left join terroir t on t.id = c.appellation_id where c.producteur_id = $1 and c.statut <> 'retire' order by c.nom`, [id]),
    requete<{ id: string; libelle: string; millesime: string | null }>(
      `select distinct on (libelle, millesime) id, libelle, millesime from vin_carte where restaurant_id = $1 and producteur_id = $2 order by libelle, millesime, ordre`, [resto, id]),
  ]);
  if (!p || !siens.length) notFound();
  // Vins du producteur chez les distributeurs de Quid Vinum (au prix du restaurant, HTVA ; jamais le prix QV) :
  // par vin de la base, et ceux du catalogue reliés au producteur sans vin de la base.
  const sansCuvee = (await requete<{ id: string }>('select id from distributeur_vin where producteur_id = $1 and actif and cuvee_id is null', [id])).map((x) => x.id);
  const offres = await offresDistributeurs(resto, { cuvees: cuvees.map((c) => c.id), vins: sansCuvee });
  // Photos et logos des vins des distributeurs (vins sans photo dans la base : celle du distributeur, sinon son logo).
  const images = new Map((offres.length ? await requete<{ id: string; etiquette: string | null; logo: string | null }>(
    'select v.id, v.etiquette_url as etiquette, d.logo_url as logo from distributeur_vin v join distributeur d on d.id = v.distributeur_id where v.id = any($1)',
    [offres.map((o) => o.id)]) : []).map((x) => [x.id, x]));
  // Déjà dans Ma cave : par l'offre du distributeur, ou par le vin de la base.
  const enCave = await requete<{ id: string; distributeur_vin_id: string | null; cuvee_id: string | null }>(
    'select id, distributeur_vin_id, cuvee_id from vin_carte where restaurant_id = $1 and (cuvee_id = any($2) or distributeur_vin_id = any($3))',
    [resto, cuvees.map((c) => c.id), offres.map((o) => o.id)]);
  const lignes = [
    ...cuvees.map((c) => ({ cle: c.id, nom: c.nom, etiquette: c.etiquette, detail: [c.appellation && c.appellation !== c.nom ? c.appellation : null, c.couleur ? COULEURS[c.couleur] : null].filter(Boolean).join(' · '),
      offres: offres.filter((o) => o.cuvee_id === c.id), cave: enCave.find((x) => x.cuvee_id === c.id) ?? null })),
    ...offres.filter((o) => !o.cuvee_id).map((o) => ({ cle: o.id, nom: o.libelle, etiquette: null as string | null, detail: '', offres: [o], cave: null })),
  ].map((l) => ({ ...l, cave: l.cave ?? enCave.find((x) => l.offres.some((o) => o.id === x.distributeur_vin_id)) ?? null,
    etiquette: l.etiquette ?? l.offres.map((o) => images.get(o.id)?.etiquette).find(Boolean) ?? null,
    logo: l.offres.map((o) => images.get(o.id)?.logo).find(Boolean) ?? null }));
  const versCave = `/admin/${resto}/stocks`;
  const ficheVin = (vinId: string) => `/admin/${resto}/carte/${encodeURIComponent(vinId)}?${new URLSearchParams({ retour: versCave })}`;
  const vers = vin ? `/admin/${resto}/carte/${encodeURIComponent(vin)}${retour ? `?${new URLSearchParams({ retour })}` : ''}` : `/admin/${resto}/stocks`;
  const lieu = [p.sous_region, p.region, p.pays].filter(Boolean).join(' · ');
  return (
    <>
      <Link href={vers} className="lien-ligne" style={{ minHeight: 0, marginBottom: -8 }}>← {vin ? 'Fiche du vin' : 'Ma cave'}</Link>
      <header className="bo-entete"><div>
        <span className="surtitre">Producteur</span>
        <h1>{p.nom}</h1>
        {lieu && <p style={{ margin: '4px 0 0', color: 'var(--discret)' }}>{lieu}</p>}
      </div></header>
      <div className="fiche-vin">
        <section className="pile" style={{ gap: 12, minWidth: 0 }}>
          <div className="carte-bo pile" style={{ gap: 12 }}>
            <dl className="infos-base">
              {p.localisation && <><dt>Situation</dt><dd>{p.localisation}</dd></>}
              {PRODUCTION[p.production] && <><dt>Culture</dt><dd>{PRODUCTION[p.production]}</dd></>}
              {p.appellations.length > 0 && <><dt>Appellations</dt><dd>{p.appellations.join(', ')}</dd></>}
              {p.cepages.length > 0 && <><dt>Cépages</dt><dd>{p.cepages.join(', ')}</dd></>}
              {p.couleurs.length > 0 && <><dt>Vins</dt><dd>{p.couleurs.map((c) => COULEURS[c] ?? c).join(', ')}</dd></>}
            </dl>
            {/* Texte de la base, sans ce qui est réservé à Pat (son profil, ses notes, un classement). */}
            {presentationPublique(p.presentation).length > 0 && <div className="pile" style={{ gap: 8 }}>{presentationPublique(p.presentation).map((par, n) => <p key={n} style={{ margin: 0 }}>{par}</p>)}</div>}
          </div>
          {/* Les vins du producteur, un bloc chacun (photo quand on l'a) : chez quel distributeur de Quid Vinum, à quel prix, et l'ajout à Ma cave. */}
          {lignes.length > 0 && (
            <section className="pile" style={{ gap: 10 }}>
              <h2 style={{ margin: '8px 0 0', fontSize: 20 }}>Les vins du producteur</h2>
              <div className="vins-producteur">
                {lignes.map((l) => (
                  <article key={l.cle} className="carte-bo vin-producteur">
                    <VignetteVin url={l.etiquette} logo={l.logo} taille={72} />
                    <div className="pile" style={{ gap: 8, minWidth: 0 }}>
                      <div><b>{l.nom}</b>{l.detail && <div className="petit discret">{l.detail}</div>}</div>
                      {l.cave ? <Link href={ficheVin(l.cave.id)} className="petit">✓ Dans Ma cave</Link> : null}
                      {!l.cave && !l.offres.length && <span className="petit discret">Pas encore chez un distributeur de Quid Vinum</span>}
                      {!l.cave && l.offres.map((o) => (
                        <div key={o.id} className="offre-producteur">
                          <span className="petit">{o.distributeur}{o.millesime ? ` · ${o.millesime}` : ''}{o.contenance && o.contenance !== '75 cl' ? ` · ${o.contenance}` : ''}
                            {o.prix != null && <> · <b>{euros(o.prix)}</b> HTVA</>}</span>
                          {o.epuise ? <span className="petit discret">épuisé</span>
                            : <AjoutCatalogue ajouter={ajouterDuCatalogue.bind(null, resto, o.distributeur_id, o.id)} libelle={o.libelle} texte="+ Ajouter à Ma cave" versCave={versCave} />}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
        <aside className="pile" style={{ gap: 16, minWidth: 0 }}>
          <div className="carte-bo pile" style={{ gap: 8 }}>
            <b>Vos vins de ce producteur</b>
            {siens.map((x) => <Link key={x.id} href={`/admin/${resto}/carte/${encodeURIComponent(x.id)}?${new URLSearchParams({ retour: `/admin/${resto}/stocks` })}`} className="petit">{x.libelle}{x.millesime ? ` ${x.millesime}` : ''}</Link>)}
          </div>
        </aside>
      </div>
    </>
  );
}
