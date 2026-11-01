// L'ajout d'un vin se fait maintenant dans la Base de vins (gestion des stocks).
import { redirect } from 'next/navigation';

export default async function AncienAjout({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string }> }) {
  const { resto } = await params;
  const { c } = await searchParams;
  redirect(`/admin/${resto}/stocks/nouveau${c ? `?c=${encodeURIComponent(c)}` : ''}`);
}
