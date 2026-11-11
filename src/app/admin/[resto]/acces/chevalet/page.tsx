import { redirect } from 'next/navigation';

/** Ancienne adresse du chevalet de table (page QR code) : il est maintenant dans le Centre d'impression. */
export default async function AncienChevalet({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ modele?: string }> }) {
  const [{ resto }, { modele }] = await Promise.all([params, searchParams]);
  redirect(`/admin/${resto}/chevalet${modele ? `?modele=${encodeURIComponent(modele)}` : ''}`);
}
