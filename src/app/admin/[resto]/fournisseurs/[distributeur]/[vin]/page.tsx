// Fiche d'un vin du catalogue d'un distributeur : grande étiquette, producteur et sa région, appellation, cépages, prix
// public et prix du restaurant (sa remise), puis « Ajouter à Ma cave » ou « + panier ». Jamais ni ranking, ni prix QV.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigerCave } from '@/lib/admin/garde-cave';
import { requete } from '@/lib/db';
import { euros } from '@/lib/bon-commande';
import { Entete, Etat } from '@/components/admin/Ui';
import { VignetteVin } from '@/components/admin/VignetteVin';
import { AjoutCatalogue, AjoutPanier } from '@/components/admin/Panier';
import { ajouterAuPanier, ajouterDuCatalogue } from '../../../../stocks-actions';
import { catalogueDistributeur, distributeursProposes } from '@/lib/distributeurs/donnees';
import { sansContenance } from '@/lib/format';
import { presentationPublique } from '@/lib/producteurs/presentation';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blanc', rose: 'Rosé', orange: 'Orange', rouge: 'Rouge', doux: 'Doux' };

export default async function FicheVinCatalogue({ params }: { params: Promise<{ resto: string; distributeur: string; vin: string }> }) {
  const { resto, distributeur, vin } = await params;
  await exigerCave(resto);
  const d = (await distributeursProposes(resto)).find((x) => x.id === distributeur);
  if (!d) notFound();
  const v = (await catalogueDistributeur(distributeur, resto)).find((x) => x.id === vin);
  if (!v) notFound();
  const [plus] = await requete<{ appellation: string | null; cepages: string | null; garde: string | null; region: string | null; pays: string | null;
    bio: boolean | null; nature: boolean | null; producteur_id: string | null; producteur_nom: string | null; producteur_texte: string | null }>(
    `select coalesce(dv.appellation, c.appellation_texte) as appellation, c.cepages, c.garde, p.region, p.pays, c.bio, c.nature,
            p.id as producteur_id, p.nom as producteur_nom, p.notes_objectives as producteur_texte
       from distributeur_vin dv left join cuvee c on c.id = dv.cuvee_id
       left join producteur p on p.id = coalesce(dv.producteur_id, c.producteur_id) and p.statut <> 'retire'
      where dv.id = $1`, [vin]);
  // Le producteur dans la base : son texte, sans ce qui est réservé à Pat (son profil, ses notes, un classement).
  const texteProducteur = presentationPublique(plus?.producteur_texte);
  // Déjà dans Ma cave : son lien, ses bouteilles au panier, et la présentation que Pat en a écrite pour ce restaurant.
  const [x] = await requete<{ id: string; panier: number; presentation: string | null }>(
    `select v.id, coalesce(p.quantite, 0) as panier, v.presentation from vin_carte v left join panier p on p.restaurant_id = v.restaurant_id and p.vin_id = v.id
      where v.restaurant_id = $1 and v.distributeur_vin_id = $2 order by v.disponible desc limit 1`, [resto, vin]);
  const retour = `/admin/${resto}/fournisseurs/${distributeur}`;
  const titre = `${v.libelle}${v.millesime && !v.libelle.includes(v.millesime) ? ` ${v.millesime}` : ''}`;
  const origine = [plus?.region, plus?.pays].filter(Boolean).join(', ');
  const infos: [string, string | null | undefined][] = [
    ['Producteur', [v.producteur, origine].filter(Boolean).join(' · ')],
    ['Appellation', plus?.appellation],
    ['Couleur', v.couleur ? COULEURS[v.couleur] ?? v.couleur : null],
    ['Millésime', v.millesime],
    ['Cépages', plus?.cepages],
    ['Contenance', v.contenance],
    ['Garde', plus?.garde],
    ['Certification', [v.certification, plus?.bio ? 'Bio' : null, plus?.nature ? 'Nature' : null].filter(Boolean).join(' · ')],
    ['Référence', v.reference],
  ];

  return (
    <>
      <Entete titre={titre}>
        <Link href={retour} className="btn fantome">← Catalogue {d.nom}</Link>
      </Entete>
      <article className="fiche-catalogue">
        <div className="fiche-catalogue-photo"><VignetteVin url={v.etiquette_url} logo={d.logo_url} taille={360} plein /></div>
        <div className="fiche-catalogue-texte">
          <div className="pile" style={{ gap: 4 }}>
            <span className="surtitre">{d.nom}{v.section ? ` · ${v.section}` : ''}</span>
            {v.producteur && <span className="fiche-catalogue-producteur">{v.producteur}</span>}
            {v.epuise && <span><Etat type="defaut">Épuisé chez le distributeur</Etat></span>}
          </div>
          <div className="fiche-catalogue-prix">
            <div><small>Prix public HTVA</small><span style={{ textDecoration: d.remise > 0 && v.prix_public != null ? 'line-through' : undefined }}>{v.prix_public != null ? euros(v.prix_public) : '—'}</span></div>
            <div className="votre-prix"><small>Votre prix HTVA{d.remise > 0 ? ` (−${String(d.remise).replace('.', ',')} %)` : ''}</small><b>{v.prix != null ? euros(v.prix) : '—'}</b></div>
          </div>
          <dl className="fiche-catalogue-infos">
            {infos.filter(([, t]) => t).map(([l, t]) => <div key={l}><dt>{l}</dt><dd>{t}</dd></div>)}
          </dl>
          {x?.presentation && <p className="fiche-catalogue-presentation">{sansContenance(x.presentation)}</p>}
          {plus?.producteur_id && texteProducteur.length > 0 && (
            <section className="fiche-catalogue-producteur-texte" aria-label={`Le producteur : ${plus.producteur_nom}`}>
              <span className="surtitre">Le producteur</span>
              {texteProducteur.map((par, n) => <p key={n}>{par}</p>)}
              <Link href={`/admin/${resto}/producteurs/${encodeURIComponent(plus.producteur_id)}?${new URLSearchParams({ retour: `${retour}/${encodeURIComponent(vin)}` })}`} className="petit">
                Tous les vins de {plus.producteur_nom} →</Link>
            </section>
          )}
          <div className="ligne-actions" style={{ alignItems: 'center' }}>
            {x ? <>
              <Link href={`/admin/${resto}/carte/${encodeURIComponent(x.id)}?${new URLSearchParams({ retour })}`} className="btn sec">✓ Dans Ma cave</Link>
              {!v.epuise && <AjoutPanier ajouter={ajouterAuPanier.bind(null, resto, x.id)} libelle={v.libelle} dansPanier={x.panier} />}
            </> : !v.epuise && <AjoutCatalogue ajouter={ajouterDuCatalogue.bind(null, resto, distributeur, v.id)} libelle={v.libelle} texte="+ Ajouter à Ma cave" />}
          </div>
        </div>
      </article>
    </>
  );
}
