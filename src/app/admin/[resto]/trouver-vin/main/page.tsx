// « Ajouter un vin » → à la main : le restaurant décrit lui-même le vin (même fiche qu'un vin en attente de validation).
// Le vin passe « En attente de validation » : Quid Vinum le vérifie et le relie à sa base (reconnu tout de suite s'il y est déjà).
import Link from 'next/link';
import { FormulaireAjoutVin } from '../../stocks/FormulaireAjoutVin';
import { Entete } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';

export default async function AjoutALaMain({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  return (
    <>
      <Entete titre="Ajouter ma référence" texte="Décrivez le vin : il s’ajoute à vos vins « En attente de validation », le temps que Quid Vinum le vérifie.">
        <Link href={`/admin/${resto}/trouver-vin`} className="btn fantome">← Ajouter un vin</Link>
      </Entete>
      <FormulaireAjoutVin resto={resto} manuel />
    </>
  );
}
