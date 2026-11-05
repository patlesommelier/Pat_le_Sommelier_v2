// Fiche d'un producteur pour le restaurant (lecture seule) : ce que la base de Quid Vinum dit de lui, ses vins de la base,
// et les vins du restaurant qui viennent de chez lui. Jamais de notes ni de classement (réservés à Pat).
// Seulement pour un producteur dont le restaurant a au moins un vin.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { presentationPublique } from '@/lib/producteurs/presentation';

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
    requete<{ id: string; nom: string; appellation: string | null; couleur: string | null }>(
      `select c.id, c.nom, coalesce(t.nom, c.appellation_texte) as appellation, c.couleur::text as couleur
         from cuvee c left join terroir t on t.id = c.appellation_id where c.producteur_id = $1 and c.statut <> 'retire' order by c.nom`, [id]),
    requete<{ id: string; libelle: string; millesime: string | null }>(
      `select distinct on (libelle, millesime) id, libelle, millesime from vin_carte where restaurant_id = $1 and producteur_id = $2 order by libelle, millesime, ordre`, [resto, id]),
  ]);
  if (!p || !siens.length) notFound();
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
        </section>
        <aside className="pile" style={{ gap: 16, minWidth: 0 }}>
          <div className="carte-bo pile" style={{ gap: 8 }}>
            <b>Vos vins de ce producteur</b>
            {siens.map((x) => <Link key={x.id} href={`/admin/${resto}/carte/${encodeURIComponent(x.id)}`} className="petit">{x.libelle}{x.millesime ? ` ${x.millesime}` : ''}</Link>)}
          </div>
          {cuvees.length > 0 && (
            <div className="carte-bo pile" style={{ gap: 6 }}>
              <b>Ses vins dans la base Quid Vinum</b>
              {cuvees.map((c) => <span key={c.id} className="petit">{c.nom}<span className="discret">{[c.appellation && c.appellation !== c.nom ? c.appellation : null, c.couleur ? COULEURS[c.couleur] : null].filter(Boolean).map((x) => ` · ${x}`).join('')}</span></span>)}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
