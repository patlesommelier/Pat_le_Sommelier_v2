import { notFound } from 'next/navigation';
import { enregistrerApparence } from '../../actions';
import { EditeurApparence, type MiseEnPage } from '@/components/admin/EditeurApparence';
import { Entete, Message } from '@/components/admin/Ui';
import { getPlatsBO, getRestaurantBO } from '@/lib/admin/donnees';
import { exigerAcces } from '@/lib/admin/auth';
import { CouleurImpression } from '@/components/admin/CouleurImpression';
import { couleurDuLogo } from '@/lib/couleur-logo';
import { couleurImpression } from '@/lib/couleurs';

export default async function Apparence({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [r, plats] = await Promise.all([getRestaurantBO(resto), getPlatsBO(resto)]);
  if (!r) notFound();
  const logoCouleur = (await couleurDuLogo(r.logo_fonce_url)) ?? (await couleurDuLogo(r.logo_url));
  return (
    <>
      <Entete titre="Apparence" />
      <Message ok={sp.ok ? 'Apparence enregistrée : l’app de vos clients est à jour.' : undefined} erreur={sp.erreur} />
      <EditeurApparence action={enregistrerApparence.bind(null, resto)} nom={r.nom} couleur={r.couleur} logo={r.logo_url} logoFonce={r.logo_fonce_url} logoChoix={r.logo_choix}
        accroche={r.accroche} pageAccueil={r.page_accueil} miseEnPage={(['classique', 'sombre', 'bento', 'brut', 'edito', 'relief'].includes(r.design_app ?? '') ? r.design_app : 'creme') as MiseEnPage} plats={plats.filter((p) => p.actif && p.categorie === 'entree').map((p) => p.nom_court ?? p.nom)}
        impression={<CouleurImpression initiale={r.couleur_impression} app={r.couleur.toUpperCase()} logo={logoCouleur} auto={couleurImpression(r.couleur.toUpperCase(), logoCouleur)} />} />
    </>
  );
}
