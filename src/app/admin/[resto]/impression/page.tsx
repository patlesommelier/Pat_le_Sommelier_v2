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
import { couleurDuLogo } from '@/lib/couleur-logo';
import { couleurImpression } from '@/lib/couleurs';

export default async function CentreDImpression({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const r = await getRestaurantBO(resto);
  if (!r) notFound();
  const logoCouleur = (await couleurDuLogo(r.logo_fonce_url)) ?? (await couleurDuLogo(r.logo_url));
  return (
    <>
      <Entete titre="Centre d’impression" />
      <Message ok={sp.ok} erreur={sp.erreur} />
      <CentreImpression action={enregistrerImpression.bind(null, resto)} resto={resto}
        logoApp={r.logo_fonce_url ?? r.logo_url} logoImpression={r.logo_impression_url}
        fond={r.couleur_impression ?? couleurImpression(r.couleur.toUpperCase(), logoCouleur)}
        design={estDesignCarte(r.design_impression) ? r.design_impression : 'classique'}
        couleur={<CouleurImpression initiale={r.couleur_impression} app={r.couleur.toUpperCase()} logo={logoCouleur} auto={couleurImpression(r.couleur.toUpperCase(), logoCouleur)}
          enregistrer={changerCouleurImpression.bind(null, resto)} />} />
    </>
  );
}
