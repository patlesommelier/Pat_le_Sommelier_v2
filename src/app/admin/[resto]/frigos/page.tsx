// Frigos connectés — Mes frigos : chaque frigo (WineMS) du restaurant, son état et ses vins.
import { exigerCave } from '@/lib/admin/garde-cave';
import { Entete } from '@/components/admin/Ui';
import { FrigoConnecte } from '@/components/admin/FrigoConnecte';
import { getFrigos } from '@/lib/frigos/winems';

export default async function Frigos({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerCave(resto);
  const frigos = await getFrigos(resto);
  return (
    <>
      <Entete titre="Mes frigos" texte="Vos frigos connectés, en consignation chez LVQNEP : leur état, leur température et les bouteilles qu’ils contiennent, mis à jour toutes les quelques minutes." />
      {!frigos.length && <p className="discret">Aucun frigo connecté pour l’instant.</p>}
      {frigos.map((f) => <FrigoConnecte key={f.id} f={f} />)}
    </>
  );
}
