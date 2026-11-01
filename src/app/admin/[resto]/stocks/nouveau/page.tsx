// L'ajout d'un vin se fait dans une fenêtre de la Base de vins.
import { redirect } from 'next/navigation';

export default async function AncienAjout({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ c?: string }> }) {
  const { resto } = await params;
  const { c } = await searchParams;
  redirect(`/admin/${resto}/stocks?${new URLSearchParams({ ajout: '1', ...(c ? { c } : {}) })}`);
}
