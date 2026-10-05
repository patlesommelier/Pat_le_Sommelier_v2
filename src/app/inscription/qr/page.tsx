import Link from 'next/link';
import { redirect } from 'next/navigation';
import s from '../inscription.module.css';
import { Progression } from './progression';
import { renvoyerEmail } from '../actions';
import { supabaseConfigure } from '@/lib/admin/supabase';
import { requete } from '@/lib/db';
import { inscriptionCourante } from '@/lib/inscription/etat';
import { finaliserSiConfirme } from '@/lib/inscription/reprise';
import { Attente } from './attente';

export const dynamic = 'force-dynamic';

export default async function Qr({ searchParams }: { searchParams: Promise<{ erreur?: string; renvoye?: string }> }) {
  const { erreur, renvoye } = await searchParams;
  const i = await inscriptionCourante();
  if (!i) redirect('/inscription');
  if (i.statut === 'en_cours') redirect('/inscription/compte');

  if (i.statut === 'compte_cree') {
    // Adresse confirmée ailleurs (autre appareil, lien qui n'est pas revenu ici) : le restaurant est créé maintenant.
    const resto = await finaliserSiConfirme(i, { attendre: false }).catch((e) => { console.error('[inscription] attente', e); return null; });
    if (resto) redirect('/inscription/qr');
    return (
      <main className={s.contenu}>
        <h1 className={s.titre}>Vérifiez votre e-mail</h1>
        <p className={s.texte}>Nous avons envoyé un lien à <strong>{i.email}</strong>. Ouvrez-le pour confirmer votre adresse : Pat commencera alors à préparer vos accords, et votre QR code s’affichera ici.</p>
        {erreur && <p className={s.alerte}>La création de votre espace n’a pas abouti. Rouvrez le lien de l’e-mail ; si le problème continue, contactez-nous.</p>}
        {renvoye && <p className={s.succes}>E-mail renvoyé.</p>}
        <p className={s.texte} style={{ fontSize: 14 }}>Pensez à regarder dans les courriers indésirables. Le lien peut être ouvert sur un autre appareil : cet écran continuera tout seul.</p>
        <Attente />
        <form action={renvoyerEmail}><button type="submit" className={s.boutonSecondaire}>Renvoyer l’e-mail</button></form>
        {!supabaseConfigure() && !process.env.NETLIFY && (
          // Développement local sans Supabase : il n'y a pas d'e-mail, ce lien le remplace.
          <a href={`/auth/inscription-confirmee?i=${i.id}&dev=1`} className={s.lien}>Confirmer (développement local)</a>
        )}
      </main>
    );
  }

  const id = i.restaurant_id!;
  // Le QR code n'est montré qu'une fois tous les plats prêts (restaurant en service) : avant, l'avancement.
  const [r] = await requete<{ statut: string }>('select statut from restaurant where id = $1', [id]);
  const pret = r?.statut === 'en_service';
  return (
    <>
      <main className={s.contenu}>
        <p className={s.succes}>E-mail confirmé · bienvenue, {i.nom_restaurant}</p>
        <h1 className={s.titre}>{pret ? 'Votre QR code' : 'Pat prépare vos accords'}</h1>
        {pret ? (
          <>
            <p className={s.texte}>Posez-le sur vos tables : vos clients scannent, choisissent leur plat, et Pat leur propose trois vins de votre carte.</p>
            <div className={s.qr}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/inscription/qr/image" alt={`QR code de ${i.nom_restaurant}`} width={200} height={200} />
              <span className={s.texte} style={{ fontSize: 13.5, fontWeight: 700 }}>Scannez pour choisir votre vin</span>
            </div>
            <a href="/inscription/qr/image?format=png" className={s.boutonSecondaire} download>Télécharger le QR code</a>
            <p className={s.succes} role="status">Vos accords sont prêts : le QR code fonctionne.</p>
          </>
        ) : (
          <>
            <p className={s.texte}>Pat note chaque vin de votre carte sur chaque plat de votre menu. Votre QR code apparaîtra ici dès que tous vos plats auront leurs accords.</p>
            <Progression />
          </>
        )}
      </main>
      <div className={s.barreAction}><div><Link href={`/admin/${id}`} className={s.bouton}>Accéder à mon espace</Link></div></div>
    </>
  );
}
