import { notFound } from 'next/navigation';
import { enregistrerApparence } from '../../actions';
import { EditeurApparence, type MiseEnPage } from '@/components/admin/EditeurApparence';
import { Entete, Message } from '@/components/admin/Ui';
import { getPlatsBO, getRestaurantBO } from '@/lib/admin/donnees';
import { exigerAcces } from '@/lib/admin/auth';

export default async function Apparence({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const [r, plats] = await Promise.all([getRestaurantBO(resto), getPlatsBO(resto)]);
  if (!r) notFound();
  return (
    <>
      <Entete titre="Apparence" />
      <Message ok={sp.ok ? 'Apparence enregistrée : l’app de vos clients est à jour.' : undefined} erreur={sp.erreur} />
      <EditeurApparence action={enregistrerApparence.bind(null, resto)} nom={r.nom} couleur={r.couleur} logo={r.logo_url} logoFonce={r.logo_fonce_url} logoChoix={r.logo_choix}
        accroche={r.accroche} pageAccueil={r.page_accueil} miseEnPage={(['classique', 'sombre', 'bento', 'brut', 'edito', 'relief', 'greige', 'ardoise'].includes(r.design_app ?? '') ? r.design_app : 'creme') as MiseEnPage} plats={plats.filter((p) => p.actif && p.categorie === 'entree').map((p) => p.nom_court ?? p.nom)}
        />
    </>
  );
}
