// Page d'accueil de Pat le sommelier, proposition « Le carnet » choisie par Pat :
//   1. présentation (crème du logo) : logo écrit, titre, texte, Pat attablé avec deux bulles de conversation et le petit
//      QR code rouge de l'app de démo ;
//   2. inscription en frise sur fond rose (1/3 carte des vins, 2/3 menu, 3/3 restaurant) ;
//   3. « Qui est Pat ? » ; puis le pied de page.
// « Ce que je change dans votre restaurant » (Avantages) et « Sous le capot » (Fonctionnalites) restent dans Sections.tsx
// pour plus tard ; le téléphone de démo (TelephoneDemo.tsx) aussi.
import Link from 'next/link';
import s from './carnet.module.css';
import { Inscription } from './Inscription';
import { BullesPat } from './BullesPat';
import { BandeauQui } from './BandeauQui';
import { TexteRepliable } from './TexteRepliable';
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
      <section aria-labelledby="h-intro">
        <div className={s.large}>
          <header className={s.entete}>
            <Link href="/" aria-label="Pat le sommelier, accueil">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pat/pat-logo-rouge.svg" alt="Pat le sommelier" width={90} height={58} />
            </Link>
            <Link href="/admin/connexion" className={s.connexion}>Se connecter</Link>
          </header>
          <div className={s.intro}>
            <TexteRepliable className={s.repliable}>
              <h1 id="h-intro" className={s.titre}>Offrez à chaque client de votre restaurant l’expérience d’un sommelier</h1>
              <p className={s.texte}>Votre client choisit son plat, je lui suggère les vins qui l’accompagnent et je lui explique pourquoi. Vos clients sont mieux conseillés, ils commandent plus volontiers une bouteille, et votre chiffre d’affaires moyen augmente. C’est mis en place en 3 clics, et c’est gratuit.</p>
            </TexteRepliable>
            {/* Pat attablé et, à sa droite, un peu plus bas, le QR code ; l'ensemble est centré. */}
            <div className={s.sceneLigne}>
              <div className={s.scene}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/pat/pat-attable-rouge.svg" alt="Pat, le sommelier, attablé avec sa bouteille et son verre" width={560} height={440} />
                <BullesPat />
              </div>
              {/* QR de l'app de démo Chez Pat (NEXT_PUBLIC_DEMO_URL, sinon /chez-pat), rouge comme Pat */}
              <a className={s.qr} href="/chez-pat" target="_blank" rel="noopener">
                Scannez ici
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/api/demo-qr?couleur=pat" alt="QR code à scanner pour essayer l’app de démonstration Chez Pat" width={84} height={84} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-insc" id="demarrer" className={s.inscription}>
        <div className={s.large}>
          <h2 id="h-insc">Votre sommelier est prêt en quelques minutes</h2>
          <Inscription initial={resume} restaurantCree={suivi?.id ?? null} />
        </div>
      </section>

      <section aria-labelledby="h-qui">
        <div className={`${s.large} ${s.qui}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className={s.quiImage}><img src="/pat/pat-trinquer-fuchsia.svg" alt="" width={380} height={294} /></span>
          {/* Pendant l'inscription, les avantages puis les fonctionnalités de Pat défilent ici. */}
          <BandeauQui>
            <div>
              <h2 id="h-qui">Qui est Pat ?</h2>
              <p>Derrière cette app, il y a un vrai sommelier diplômé du WSET, avec des dizaines d’années d’expérience et de connaissance. Il a appris que le vin, c’est simple, mais qu’un bon accord se construit et ne se devine pas. Chaque accord entre un plat de votre menu et un vin de votre carte est évalué sur la base de principes bien définis, construits au fil des années. Pat donne un vin qui répond au plat, avec des explications simples ; il choisit un vigneron et un terroir bien plus qu’une étiquette.</p>
            </div>
          </BandeauQui>
        </div>
      </section>

      <footer className={s.pied}>
        <div className={s.large}>
          <span>Pat le sommelier · Belgique</span>
          <nav aria-label="Informations"><Link href="/conditions">Conditions d’utilisation</Link></nav>
        </div>
      </footer>
    </div>
  );
}
