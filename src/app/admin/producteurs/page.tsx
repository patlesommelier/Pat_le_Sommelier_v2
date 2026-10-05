import { redirect } from 'next/navigation';

/** Ancienne adresse : la file des producteurs est dans l'espace super-admin. */
export default function ProducteursProposes() {
  redirect('/admin/super/producteurs');
}
