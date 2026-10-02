import { redirect } from 'next/navigation';

// Pour l'instant un seul restaurant : la racine mène à Lola.
export default function Accueil() {
  redirect('/lola');
}
