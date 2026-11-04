// Page d'accueil de quidvinum.com (proposition « B » choisie par Pat) : la solution vin des restaurants.
//   1. grand bandeau anthracite : titre, accroche, boutons ; en dessous, l'aperçu (espace restaurant illustré + l'app de Pat en vidéo) ;
//   2. « Pourquoi Quid Vinum », puis les 6 avantages en cartes (Pat le sommelier en orange) ;
//   3. avantages en bref et « Comment ça marche » côte à côte ;
//   4. inscription (le formulaire existant : carte des vins, menu, restaurant) sur fond anthracite.
import { Fragment } from 'react';
import Link from 'next/link';
import s from './quidvinum.module.css';
import { Inscription } from './Inscription';
import { Icone } from '@/components/admin/Icone';
import { inscriptionCourante } from '@/lib/inscription/etat';
import { requete } from '@/lib/db';
import { resumePublic } from '@/lib/inscription/etapes';

const AVANTAGES: { titre: string; icone: string; textes: React.ReactNode[]; pat?: boolean }[] = [
  { titre: 'Une gestion de stock simplifiée et automatisée', icone: 'stock', textes: [
    'Votre cave est tenue à jour sans effort. Dès qu’une référence passe sous le seuil que vous avez fixé, elle vous est signalée et peut être recommandée immédiatement. Les bouteilles commandées sont suivies jusqu’à leur réception, puis ajoutées au stock d’un simple clic.',
    'Chaque vin de votre stock apparaît directement sur votre carte des vins, et il en est retiré dès qu’il n’est plus disponible. Vous savez à tout moment ce que vous avez en cave, ce qui est en commande et ce qu’il faut réassortir.'] },
  { titre: 'Des commandes regroupées', icone: 'camion', textes: [
    <><b>Une seule interface pour tous vos distributeurs.</b> Vous passez vos commandes en une fois, Quid Vinum les transmet à vos distributeurs et en assure le suivi, de la validation à la livraison. Les factures sont également centralisées dans votre espace.</>,
    <><b>Le réseau de distributeurs partenaires de Quid Vinum.</b> Vous accédez à une sélection de fournisseurs de vin partenaires et à leurs catalogues, à des conditions tarifaires avantageuses.</>] },
  { titre: 'Une carte des vins rédigée et imprimée pour vous', icone: 'print', textes: [
    'Votre carte des vins est construite automatiquement à partir de votre cave : les vins sont classés, présentés et décrits de façon claire et homogène. Elle s’imprime aux couleurs de votre restaurant et se met à jour dès que votre offre évolue.',
    'Pour élargir votre carte, il suffit de décrire votre besoin (un plat, un style, un budget) : Quid Vinum vous propose les références les plus adaptées dans les catalogues de vos distributeurs.'] },
  { titre: 'Des accords mets-vins établis pour chaque plat', icone: 'menu', textes: [
    'Chaque plat de votre menu est associé aux vins de votre carte qui l’accompagnent le mieux. Les accords sont établis selon des principes de sommellerie éprouvés, sous la supervision d’un sommelier diplômé du WSET. Vous gardez la main : vous validez, ajustez ou fixez vos propres règles.'] },
  { titre: 'Un appui pour votre personnel en salle', icone: 'users', textes: [
    'Votre équipe parle du vin avec assurance, même sans formation spécifique.',
    'Au moment de prendre la commande, les accords conseillés pour chaque plat et leurs explications sont accessibles en un instant, sur téléphone ou tablette.',
    'La carte est dynamique : elle suit votre stock et ne présente que les vins disponibles en cave. Fini les « désolé, nous n’en avons plus ».'] },
  { titre: 'Pat le sommelier : le conseil à chaque table', icone: 'pat', pat: true, textes: [
    'Grâce à un QR code, vos clients ont accès à votre carte des vins et à un sommelier virtuel. Ils choisissent leur plat et reçoivent les suggestions de Pat, accompagnées d’une explication claire.',
    <><b>Résultat :</b> un service du vin homogène, même sans sommelier en salle, et davantage de bouteilles vendues.</>] },
];

const EN_BREF = [
  'Une gestion de stock simplifiée et automatisée',
  'Des commandes regroupées et suivies, pour tous vos distributeurs',
  'L’accès à un réseau de distributeurs partenaires à prix avantageux',
  'Une carte des vins rédigée, imprimée et toujours à jour',
  'Des accords mets-vins établis par des principes de sommellerie',
  'Un personnel en salle épaulé, avec une carte toujours à jour',
  'Un conseil professionnel à chaque table, et plus de vin vendu',
  'Un service gratuit, opérationnel en quelques minutes',
];

const ETAPES = [
  'Créez l’espace de votre restaurant.',
  'Importez votre menu et votre carte des vins.',
  'Placez le QR code sur vos tables. Vous gérez vos vins, votre carte et vos commandes depuis votre espace ; vos clients sont conseillés à table.',
  'Renseignez votre stock de bouteilles : votre cave est suivie et les vins à réassortir vous sont signalés.',
];

/**
 * Aperçu illustré : à gauche « Ma cave » (étiquettes reprises des vidéos de démonstration) comme dans l'espace restaurant, à droite l'app de Pat en vidéo (démonstration
 * « L'Improbable », filet pur poivre vert). Les vins que Pat propose dans la vidéo sont ceux de la cave, surlignés.
 */
const CAVE: { groupe?: string; nom: string; detail: string; distributeur: string; prix: string; stock: number; etiquette: string; propose?: boolean }[] = [
  { groupe: 'Rouges', nom: 'Michelon 2014', detail: 'Domaine Jules Desjourneys · Moulin-à-Vent', distributeur: 'Vins du Beaujolais', prix: '145,00', etiquette: '/accueil/etiquettes/michelon.jpg', stock: 6, propose: true },
  { nom: 'Trévallon 2009', detail: 'Domaine de Trévallon · IGP Alpilles', distributeur: 'Provence Sélection', prix: '190,00', etiquette: '/accueil/etiquettes/trevallon.jpg', stock: 2, propose: true },
  { groupe: 'Blancs', nom: 'Terre de Maimbray 2022', detail: 'Reverdy · Sancerre', distributeur: 'Vins de Loire SA', prix: '45,70', etiquette: '/accueil/etiquettes/maimbray.jpg', stock: 12 },
  { nom: 'Brut de Brabant', detail: 'Domaine W · Chardonnay', distributeur: 'Belgian Wines', prix: '86,00', etiquette: '/accueil/etiquettes/brabant.jpg', stock: 9 },
];

function Apercu() {
  return (
    <figure className={s.apercu} aria-hidden="true">
      <div className={s.ecran}>
        <div className={s.ecranBarre}><i /><i /><i /><span>quidvinum.com · Espace restaurant</span></div>
        <div className={s.app}>
          <aside className={s.menuApp}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/quidvinum/logo.png" alt="" className={s.menuLogo} />
            <div className={s.menuResto}><b>L</b><span>L’Improbable<small>24 plats · 38 vins</small></span></div>
            <span className={s.menuSection}>Cartes et menus</span>
            <span className={s.menuLien}><Icone nom="menu" taille={14} />Gérer le menu</span>
            <span className={s.menuLien}><Icone nom="bottle" taille={14} />Carte des vins</span>
            <span className={s.menuLien}><Icone nom="pat" taille={13} />Règles du sommelier</span>
            <span className={s.menuSection}>Base des vins</span>
            <span className={`${s.menuLien} ${s.menuActif}`}><Icone nom="stock" taille={14} />Ma cave</span>
            <span className={s.menuLien}><Icone nom="camion" taille={14} />Commandes</span>
            <span className={s.menuLien}><Icone nom="fournisseur" taille={14} />Distributeurs</span>
          </aside>
          <div className={s.caveApp}>
            <b className={s.caveTitre}>Ma cave</b>
            <div className={s.tuiles}>
              <span><b>1</b>vin en stock bas</span><span><b>214</b>bouteilles en stock</span><span><b>24</b>bouteilles en commande</span>
            </div>
            <div className={s.tableau}>
              <div className={s.entetes}><span>Vin</span><span>Distributeur</span><span>Prix de vente</span><span>En stock</span></div>
              {CAVE.map((v) => (
                <Fragment key={v.nom}>
                  {v.groupe && <div className={s.groupe}>{v.groupe}</div>}
                  <div className={`${s.rangee}${v.propose ? ` ${s.rangeeLiee}` : ''}`}>
                    <span className={s.vinCave}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={s.bouteille} src={v.etiquette} alt="" />
                      <span><b>{v.nom}</b><small>{v.detail}</small></span>
                    </span>
                    <span className={s.cellule}>{v.distributeur}</span>
                    <span className={s.cellule}>{v.prix} €</span>
                    <span className={s.cellule}>{v.stock}{v.stock <= 2 && <b className={s.alerte}>!</b>}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={s.telephone}>
        <video muted autoPlay loop playsInline preload="metadata" poster="/demo/demo-2-filet-debut.jpg">
          <source src="/demo/demo-2-filet.webm" type="video/webm" />
          <source src="/demo/demo-2-filet.mp4" type="video/mp4" />
        </video>
      </div>
    </figure>
  );
}

export async function PageQuidVinum() {
  // Inscription terminée dans ce navigateur : formulaire vierge pour un nouveau restaurant.
  const i = await inscriptionCourante();
  const resume = resumePublic(i?.statut === 'en_cours' ? i : null);
  // Restaurant créé depuis ce navigateur dont le QR code n'a pas encore été scanné : la page suit la préparation.
  const [suivi] = i?.statut === 'finalisee' && i.restaurant_id
    ? await requete<{ id: string }>('select id from restaurant where id = $1 and premier_scan_le is null', [i.restaurant_id]) : [];
  return (
    <div className={s.page}>
      <section className={s.bandeau} aria-labelledby="h-titre">
        <header className={s.entete}>
          <Link href="/" aria-label="Quid Vinum, accueil">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/quidvinum/logo-clair.png" alt="Quid Vinum" height={44} />
          </Link>
          <nav aria-label="Navigation" className={s.liens}>
            <a href="#solution">La solution</a>
            <a href="#comment">Comment ça marche</a>
            <Link href="/admin/connexion">Se connecter</Link>
            <a href="#demarrer" className={`${s.btn} ${s.btnPetit}`}>Inscrire mon restaurant</a>
          </nav>
        </header>
        <div className={s.centre}>
          <h1 id="h-titre">Développez et gérez <span>l’offre vin</span> de votre restaurant.</h1>
          <p className={s.accroche}>Quid Vinum gère vos stocks, regroupe vos commandes, rédige et imprime votre carte des vins, vous aide à composer les accords avec vos plats et conseille vos clients à table.</p>
          <p className={s.fort}>Gratuite, la solution est opérationnelle en quelques minutes.</p>
          <div className={s.boutons}>
            <a href="#demarrer" className={s.btn}>Inscrire mon restaurant</a>
            <a href="#comment" className={`${s.btn} ${s.btnSec}`}>Voir comment ça marche</a>
          </div>
        </div>
      </section>

      <div className={s.large}><Apercu /></div>

      <section className={s.pourquoi} aria-labelledby="h-pourquoi" id="solution">
        <h2 id="h-pourquoi">Pourquoi Quid Vinum</h2>
        <p>Le vin est l’une des premières sources de revenus d’un restaurant, mais aussi l’une des plus exigeantes à gérer. Quid Vinum centralise toute votre offre vin dans un espace unique, simple d’utilisation et pensé pour les restaurateurs.</p>
      </section>

      <section className={`${s.large} ${s.cartes}`} aria-label="La solution">
        {AVANTAGES.map((a, n) => (
          <article key={a.titre} className={`${s.carte}${a.pat ? ` ${s.cartePat}` : ''}`}>
            <span className={s.icone}><Icone nom={a.icone} taille={a.pat ? 40 : 24} /></span>
            <span className={s.num}>{String(n + 1).padStart(2, '0')}</span>
            <h3>{a.titre}</h3>
            {a.textes.map((t, k) => <p key={k}>{t}</p>)}
          </article>
        ))}
      </section>

      <section className={s.bande} aria-label="En bref">
        <div className={`${s.large} ${s.bandeGrille}`}>
          <div>
            <h2>Les avantages en bref</h2>
            <ul className={s.bref}>{EN_BREF.map((a) => <li key={a}><Icone nom="check" taille={16} epaisseur={2.6} />{a}</li>)}</ul>
          </div>
          <div id="comment">
            <h2>Comment ça marche</h2>
            <ol className={s.etapes}>{ETAPES.map((e, n) => <li key={e}><b>{n + 1}</b><span>{e}</span></li>)}</ol>
          </div>
        </div>
      </section>

      <section className={s.final} aria-labelledby="h-insc" id="demarrer">
        <div className={s.large}>
          <h2 id="h-insc">Rejoignez Quid Vinum.</h2>
          <p className={s.finalTexte}>L’inscription est gratuite. Votre espace est prêt en quelques minutes.</p>
          <div className={s.formulaire}><Inscription initial={resume} restaurantCree={suivi?.id ?? null} /></div>
        </div>
      </section>

      <footer className={s.pied}>
        <div className={s.large}>
          <span>© Quid Vinum · Belgique</span>
          <nav aria-label="Informations"><Link href="/conditions">Conditions d’utilisation</Link></nav>
        </div>
      </footer>
    </div>
  );
}
