// Page d'accueil de Pat le sommelier — maquette « Page d'accueil · inscription (3 niveaux) » :
//   1. présentation (bordeaux) : titre, texte, QR « Scannez pour essayer » et app de démo Chez Pat ;
//   2. « Qu'est-ce que Pat vous apporte ? » (crème) ;
//   3. activation (bordeaux) : formulaire doré, une étape à la fois ;
//   4. « Fonctionnalités » (crème) ; puis le pied de page.
import Link from 'next/link';
import s from './accueil.module.css';
import { Inscription } from './Inscription';
import { TelephoneDemo } from './TelephoneDemo';
import { Avantages, Fonctionnalites } from './Sections';
import { inscriptionCourante } from '@/lib/inscription/etat';
import { requete } from '@/lib/db';
import { resumePublic } from '@/lib/inscription/etapes';

export async function PageAccueil() {
  // Inscription terminée dans ce navigateur : formulaire vierge pour un nouveau restaurant.
  const i = await inscriptionCourante();
  const resume = resumePublic(i?.statut === 'en_cours' ? i : null);
  // Restaurant créé depuis ce navigateur dont le QR code n'a pas encore été scanné : la page suit la préparation.
  const [suivi] = i?.statut === 'finalisee' && i.restaurant_id
    ? await requete<{ id: string }>('select id from restaurant where id = $1 and premier_scan_le is null', [i.restaurant_id]) : [];
  return (
    <div className={s.page}>
      <section aria-labelledby="h-intro" className={s.bordeaux}>
        <span className={s.halo} aria-hidden="true" />
        <header className={s.entete}>
          <Link href="/" className={s.marque}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className={s.pastille}><img src="/pat-logo.png" alt="" width={38} height={42} /></span>
            <span>Pat le sommelier</span>
          </Link>
          <Link href="/admin/connexion" className={s.connexion}>Se connecter</Link>
        </header>
        <div className={s.intro}>
          <div className={s.introTexte}>
            <h1 id="h-intro" className={s.titre}>Développez l’offre vin de votre restaurant grâce à Pat, votre sommelier virtuel</h1>
            <p className={s.texte}>À chaque table, vos clients choisissent leur plat et Pat leur propose plusieurs vins en accord avec quelques mots. Envoyez votre menu et votre carte des vins en image, et accédez directement au service.</p>
          </div>
          <div className={s.demo}>
            <div className={s.qr}>
              {/* QR de l'app de démo Chez Pat (NEXT_PUBLIC_DEMO_URL, sinon /chez-pat) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/demo-qr" alt="QR code à scanner pour ouvrir l’app du restaurant de démonstration Chez Pat" width={130} height={130} />
              <span>Scannez pour essayer</span>
            </div>
            <TelephoneDemo />
          </div>
        </div>
      </section>

      <Avantages />

      <section aria-label="Activer votre sommelier" id="demarrer" className={`${s.bordeaux} ${s.activation}`}>
        <Inscription initial={resume} restaurantCree={suivi?.id ?? null} />
      </section>

      <Fonctionnalites />

      <footer className={s.piedPage}>
        <span>Pat le sommelier · Belgique</span>
        <nav aria-label="Informations"><Link href="/conditions">Conditions d’utilisation</Link></nav>
      </footer>
    </div>
  );
}
