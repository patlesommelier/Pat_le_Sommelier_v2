// Avis de Quid Vinum en haut de l'espace du restaurant (ex. un de ses distributeurs devenu distributeur Quid Vinum),
// jusqu'à ce qu'il le ferme avec « Compris ».
import Link from 'next/link';
import { fermerAvis } from '@/app/admin/actions';

export interface Avis { id: string; titre: string; texte: string; lien: string | null }

export function AvisRestaurant({ resto, avis }: { resto: string; avis: Avis[] }) {
  if (!avis.length) return null;
  return (
    <div className="pile" style={{ gap: 10, marginBottom: 16 }}>
      {avis.map((a) => (
        <div key={a.id} className="avis-restaurant" role="status">
          <div className="pile" style={{ gap: 4, flex: '1 1 320px' }}>
            <b>{a.titre}</b>
            <span>{a.texte}{a.lien && <> <Link href={a.lien}>Voir mes distributeurs →</Link></>}</span>
          </div>
          <form action={fermerAvis.bind(null, resto, a.id)}><button className="btn sec petit">Compris</button></form>
        </div>
      ))}
    </div>
  );
}
