import Link from 'next/link';
// Centre d'impression : tout ce qui s'imprime au même endroit — le logo et la couleur des impressions, le menu et les suggestions,
// la carte des vins avec son design (six au choix) et son aperçu.
import { notFound } from 'next/navigation';
import { changerCouleurImpression, enregistrerImpression } from '../../actions';
import { CentreImpression } from '@/components/admin/CentreImpression';
import { CouleurImpression } from '@/components/admin/CouleurImpression';
import { Entete, Message } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO } from '@/lib/admin/donnees';
import { estDesignCarte } from '@/lib/carte-imprimable';
import { carteValidee } from '@/lib/admin/prochaine-etape';
import { couleurDuLogo, fondDuLogo } from '@/lib/couleur-logo';
import { couleurImpression } from '@/lib/couleurs';

export default async function CentreDImpression({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { resto } = await params;
  const u = await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const r = await getRestaurantBO(resto);
  if (!r) notFound();
  // Restaurant inscrit seul : l'impression de la carte s'ouvre une fois la carte validée par Quid Vinum.
  if (!u.admin && !carteValidee(r)) {
    return (
      <>
        <Entete titre="Impression de la carte des vins" />
        <section className="carte-bo pile" style={{ maxWidth: 720 }}>
          <h2 style={{ margin: 0 }}>Votre carte des vins est en relecture</h2>
          <p style={{ margin: 0, lineHeight: 1.55 }}>Quid Vinum vérifie vos vins, leurs présentations et leurs photos d’étiquette. Dès que votre carte est validée,
            vous recevez le message « La carte est complète » et vous pouvez l’imprimer ici, à vos couleurs.</p>
          <p className="discret" style={{ margin: 0 }}>En attendant, vous pouvez déjà imprimer <Link href={`/admin/${resto}/chevalet`}>votre chevalet de table</Link> avec le QR code.</p>
        </section>
      </>
    );
  }
  const logoCouleur = (await couleurDuLogo(r.logo_fonce_url)) ?? (await couleurDuLogo(r.logo_url));
  // Aperçu « sur le bandeau » : un logo à fond opaque garde son fond (comme à l'impression), sinon la couleur des impressions.
  const fondLogo = await fondDuLogo(r.logo_impression_url ?? r.logo_fonce_url ?? r.logo_url);
  return (
    <>
      <Entete titre="Centre d’impression" />
      <Message ok={sp.ok} erreur={sp.erreur} />
      <CentreImpression action={enregistrerImpression.bind(null, resto)} resto={resto}
        logoApp={r.logo_fonce_url ?? r.logo_url} logoImpression={r.logo_impression_url}
        fond={fondLogo ?? r.couleur_impression ?? couleurImpression(r.couleur.toUpperCase(), logoCouleur)}
        design={estDesignCarte(r.design_impression) ? r.design_impression : 'classique'}
        couleur={<CouleurImpression initiale={r.couleur_impression} app={r.couleur.toUpperCase()} logo={logoCouleur} auto={couleurImpression(r.couleur.toUpperCase(), logoCouleur)}
          enregistrer={changerCouleurImpression.bind(null, resto)} />} />
    </>
  );
}
