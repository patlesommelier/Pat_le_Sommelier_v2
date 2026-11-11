// Avis de Quid Vinum dans l'espace du restaurant (ex. un de ses distributeurs devenu distributeur Quid Vinum, ou « La carte
// est complète »), jusqu'à ce qu'il le ferme avec « Compris » : en bandeau en haut de la page, ou en post-it en haut à droite.
import Link from 'next/link';
import { fermerAvis } from '@/app/admin/actions';

export interface Avis { id: string; titre: string; texte: string; lien: string | null; lien_libelle?: string | null; forme?: string }

export function AvisRestaurant({ resto, avis }: { resto: string; avis: Avis[] }) {
  if (!avis.length) return null;
  const bandeaux = avis.filter((a) => a.forme !== 'post-it');
  const postIt = avis.find((a) => a.forme === 'post-it');
  return (<>
    {postIt && (
      <div className="post-it-etape post-it-avis" role="status">
        <span className="post-it-numero" aria-hidden="true">✓</span>
        <span className="pile" style={{ gap: 6, textAlign: 'left' }}>
          <b>{postIt.titre}</b>
          <span style={{ fontSize: 14.5 }}>{postIt.texte}</span>
          {postIt.lien && <Link href={postIt.lien} className="post-it-suite">{postIt.lien_libelle ?? 'Voir →'}</Link>}
          <form action={fermerAvis.bind(null, resto, postIt.id)}><button className="btn sec petit" style={{ marginTop: 4 }}>Compris</button></form>
        </span>
      </div>
    )}
    {bandeaux.length > 0 && <div className="pile" style={{ gap: 10, marginBottom: 16 }}>
      {bandeaux.map((a) => (
        <div key={a.id} className="avis-restaurant" role="status">
          <div className="pile" style={{ gap: 4, flex: '1 1 320px' }}>
            <b>{a.titre}</b>
            <span>{a.texte}{a.lien && <> <Link href={a.lien}>{a.lien_libelle ?? 'Voir mes distributeurs →'}</Link></>}</span>
          </div>
          <form action={fermerAvis.bind(null, resto, a.id)}><button className="btn sec petit">Compris</button></form>
        </div>
      ))}
    </div>}
  </>);
}
