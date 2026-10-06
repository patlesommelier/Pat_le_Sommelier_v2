// Page d'accueil de Pat le sommelier, avec le formulaire d'inscription (maquette « Page d'accueil · inscription »).
import Link from 'next/link';
import s from './accueil.module.css';
import { Inscription } from './Inscription';
import { TelephoneDemo } from './TelephoneDemo';
import { inscriptionCourante } from '@/lib/inscription/etat';
import { resumePublic } from '@/lib/inscription/etapes';

export async function PageAccueil() {
  const resume = resumePublic(await inscriptionCourante());
  return (
    <div className={s.page}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap" />
      <span className={s.halo} aria-hidden="true" />
      <header className={s.entete}>
        <Link href="/" className={s.marque}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className={s.pastille}><img src="/pat-logo.png" alt="" width={38} height={42} /></span>
          <span>Pat le sommelier</span>
        </Link>
        <Link href="/admin/connexion" className={s.connexion}>Se connecter</Link>
      </header>
      <main className={s.contenu}>
        <div className={s.gauche}>
          <h1 className={s.titre}>Développez l’offre vin de votre restaurant grâce à Pat, votre sommelier virtuel</h1>
          <p className={s.texte}>À chaque table, vos clients choisissent leur plat et Pat leur propose plusieurs vins en accord avec quelques mots. Envoyez votre menu et votre carte des vins en image, et accédez directement au service.</p>
          <Inscription initial={resume} />
        </div>
        <div className={s.droite}>
          <div className={s.qr}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/demo-qr" alt="QR code à scanner pour ouvrir l’app de Lola sur votre téléphone" width={124} height={124} />
            <span>Scannez pour essayer</span>
          </div>
          <TelephoneDemo />
        </div>
      </main>
    </div>
  );
}
