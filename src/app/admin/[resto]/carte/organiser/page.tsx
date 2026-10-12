import Link from 'next/link';
import { organiserCarte } from '../../../actions';
import { Entete, Message } from '@/components/admin/Ui';
import { OrganisationCarte, type RubriqueOrga } from '@/components/admin/OrganisationCarte';
import { exigerAcces } from '@/lib/admin/auth';
import { getVinsBO } from '@/lib/admin/donnees';
import { titreCarte } from '@/lib/admin/intitule';
import { regrouperVins } from '../etats';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['rouge', 'Rouges'], ['orange', 'Orange'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']] as const;

/** Organiser la carte : rubriques et ordre des vins d'une couleur, tels que l'app les montre. */
export default async function OrganiserCarte({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string; ok?: string; erreur?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const vins = await getVinsBO(resto);
  const presentes = COULEURS.filter(([k]) => vins.some((v) => v.couleur === k));
  const c = presentes.find(([k]) => k === sp.c)?.[0] ?? presentes[0]?.[0] ?? 'rouge';
  // Comme dans l'app : un vin par ligne (ses contenances ensemble), rubriques dans l'ordre de leur premier vin.
  const groupes = regrouperVins(vins.filter((v) => v.couleur === c));
  const rubriques: RubriqueOrga[] = [];
  for (const g of groupes) {
    const nom = g.principal.section ?? '';
    let r = rubriques.find((x) => x.nom === nom);
    if (!r) { r = { cle: `s${rubriques.length}`, nom, vins: [] }; rubriques.push(r); }
    const producteur = g.principal.producteur_texte && !/^non /i.test(g.principal.producteur_texte) ? g.principal.producteur_texte : g.principal.producteur_nom;
    const t = titreCarte({ ...g.principal, producteur });
    r.vins.push({ cle: g.principal.id, ids: g.tous.map((x) => x.id), titre: t.titre, sous: t.sousTitre ?? '',
      dispo: g.tous.some((x) => x.disponible), coeur: g.tous.some((x) => x.coup_de_coeur) });
  }

  return (
    <>
      <Entete titre="Organiser la carte" texte="Les rubriques et l’ordre des vins, exactement comme vos clients les voient dans l’app. Renommez une rubrique, glissez un vin (ou utilisez les flèches), puis enregistrez.">
        <Link href={`/admin/${resto}/carte?c=${c}`} className="btn sec">← Carte des vins</Link>
        <Link href={`/${resto}/carte?c=${c}`} target="_blank" className="btn fantome">Voir dans l’app</Link>
      </Entete>
      <Message ok={sp.ok} erreur={sp.erreur} />
      <nav className="onglets" aria-label="Couleurs">
        {presentes.map(([k, l]) => (
          <Link key={k} href={`/admin/${resto}/carte/organiser?c=${k}`} aria-current={c === k ? 'true' : undefined}>
            {l} <span>{regrouperVins(vins.filter((v) => v.couleur === k)).length}</span>
          </Link>
        ))}
      </nav>
      <OrganisationCarte key={c} action={organiserCarte.bind(null, resto, c)} initiales={rubriques} />
    </>
  );
}
