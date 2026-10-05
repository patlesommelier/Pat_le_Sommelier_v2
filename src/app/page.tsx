import { redirect } from 'next/navigation';
import { Aiguillage } from './auth/confirmation/aiguillage';
import { inscriptionCourante } from '@/lib/inscription/etat';

export const dynamic = 'force-dynamic';

// Pour l'instant la racine mène à Lola. Exception : le lien de confirmation d'inscription quand Supabase
// y renvoie (adresse de retour non autorisée) — la session est dans le fragment, lu par le navigateur.
export default async function Accueil() {
  if ((await inscriptionCourante())?.statut === 'compte_cree') redirect('/inscription/qr');
  return <Aiguillage inscription={null} repli="/lola" />;
}
