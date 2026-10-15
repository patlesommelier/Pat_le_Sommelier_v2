// Page d'accueil de Pat le sommelier, en trois parties :
//   1. présentation (crème #FEFAF1, logo Pat attablé) : titre, texte, QR et grand téléphone avec l'app de démo Chez Pat ;
//   2. activation (bordeaux) : dépôt du menu et de la carte, une étape à la fois ;
//   3. « Qui est vraiment Pat ? » (crème #FEFAF1) ; puis le pied de page.
// « Ce que je change dans votre restaurant » (Avantages) et « Sous le capot » (Fonctionnalites) sont retirées de la page
// mais gardées dans Sections.tsx pour plus tard.
import Link from 'next/link';
import s from './accueil.module.css';
import { Inscription } from './Inscription';
import { TelephoneDemo } from './TelephoneDemo';
import { QuiEstPat } from './Sections';
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
      <section aria-labelledby="h-intro" className={s.haut}>
        <span className={s.halo} aria-hidden="true" />
        <header className={s.entete}>
          <Link href="/" className={s.marque}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pat/pat-attable-rouge.svg" alt="Pat le sommelier" width={130} height={102} />
          </Link>
          <Link href="/admin/connexion" className={s.connexion}>Se connecter</Link>
        </header>
        <div className={s.intro}>
          <div className={s.introTexte}>
            <h1 id="h-intro" className={s.titre}>Offrez à chaque client l’expérience d’un sommelier</h1>
            <p className={s.texte}>Votre client choisit son plat, je lui propose quelques vins et je lui explique pourquoi ils vont ensemble.</p>
          </div>
          <div className={s.demo}>
            <div className={s.qr}>
              {/* QR de l'app de démo Chez Pat (NEXT_PUBLIC_DEMO_URL, sinon /chez-pat) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/demo-qr" alt="QR code à scanner pour ouvrir l’app du restaurant de démonstration Chez Pat" width={130} height={130} />
              <span>Scannez, choisissez un plat, et voyez ce que je raconte à vos clients.</span>
            </div>
            <TelephoneDemo echelle={1.1} />
          </div>
        </div>
      </section>

      <section aria-label="Activer votre sommelier" id="demarrer" className={`${s.bordeaux} ${s.activation}`}>
        <Inscription initial={resume} restaurantCree={suivi?.id ?? null} />
      </section>

      <QuiEstPat />

      <footer className={s.piedPage}>
        <span>Pat le sommelier · Belgique</span>
        <nav aria-label="Informations"><Link href="/conditions">Conditions d’utilisation</Link></nav>
      </footer>
    </div>
  );
}
