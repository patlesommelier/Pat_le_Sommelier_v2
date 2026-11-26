'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icone } from './Icone';
import { PastilleNotif } from './PastilleNotif';

export type EtatEtape = 'fait' | 'encours' | 'afaire';
/** Étape du menu de gauche, rangée sous son groupe ; un outil (icône) n'est pas une étape à cocher. */
export interface Etape { href: string; libelle: string; etat: EtatEtape; groupe?: string; icone?: string;
  /** Partie du menu : « Pat le sommelier » (l'expérience des clients) ou « Quid Vinum » (la cave), avec son en-tête. */
  marque?: 'pat' | 'qv';
  /** Sous-entrée, en retrait sous la précédente (« Ajouter un vin » sous la carte des vins). */
  sous?: boolean;
  /** Pastille de notification : nombre au chargement et adresse qui le relit. */
  notif?: { n: number; source: string };
  /** Entrée qui vient d'apparaître (la Gestion de cave après le premier client) : pastille « Nouveau ». */
  nouveau?: boolean;
  /** Entrée grisée, non cliquable : le message montré au survol (ex. carte pas encore validée par Quid Vinum). */
  desactive?: string;
  /** Post-its qui montrent cette entrée (chevalet, cave, distributeurs, accords, pense-bête, ajouter un vin…), un à la fois. */
  annonces?: Annonce[] }

/**
 * Post-it d'explication posé sur une entrée du menu. `numero` (interne, jamais affiché) : l'ordre ; `surPlace` : montré aussi
 * sur la page visée ; `vuSur` : page dont l'ouverture le fait disparaître (par défaut la page visée).
 */
export interface Annonce { numero: number; texte: string; surPlace?: boolean; vuSur?: string;
  /** Sur la page visée : le post-it se pose à côté de cet élément (id) plutôt que de l'entrée du menu. */
  ancre?: string }


/**
 * Ce que les deux menus (à gauche pour le super-admin, en haut pour un restaurant) partagent : la page ouverte, et le post-it
 * du moment (premiers pas après l'inscription, puis un post-it d'explication par visite) avec l'entrée qu'il montre.
 */
function useMenu(accueil: string, etapes: Etape[]) {
  const sp = useSearchParams();
  let chemin = usePathname();
  // Fiche d'un vin ouverte depuis Ma cave (?retour=…/stocks), fiche d'un producteur : on reste sur « Ma cave » dans le menu.
  const retour = sp?.get('retour') ?? '';
  if (/^\/admin\/[^/]+\/carte\/[^/]+$/.test(chemin) && /^\/admin\/[^/]+\/stocks/.test(retour)) chemin = retour.split('?')[0];
  if (/^\/admin\/[^/]+\/producteurs\//.test(chemin)) chemin = chemin.replace(/\/producteurs\/.*$/, '/stocks');
  // « Ajouter un vin » (bouton de la carte des vins) : « Gérer la carte des vins » reste en évidence dans le menu.
  const cheminMenu = chemin.replace(/\/trouver-vin(\/.*)?$/, '/carte');
  const courant = (href: string) => (href === accueil ? chemin === href : cheminMenu.startsWith(href)) ? 'page' : undefined;
  // Premiers pas après l'inscription : l'entrée du menu de l'étape suivante est entourée (son groupe déplié) et un post-it
  // la montre, après un temps pour essayer la page (voir useGuide).
  const [premiersPas, premiersPasEnCours] = useGuide(chemin, sp?.get('bienvenue') === '1', etapes);
  // Post-its d'explication (visites suivantes) : le plus petit numéro d'abord ; aucun pendant la visite des premiers pas
  // (post-its 1 à 3, même une fois finis) : ils attendent la visite suivante.
  // Un seul par visite : dès que sa page a été ouverte (ou, pour un post-it montré aussi sur sa page, dès qu'on l'a
  // quittée), ou qu'on a cliqué dessus pour le fermer, plus aucun post-it ni entourage jusqu'à la visite suivante.
  // Le menu (layout) n'étant pas relu en changeant de page, c'est retenu ici, dans l'onglet.
  const candidates = etapes.flatMap((e) => (e.annonces ?? []).map((a) => ({ href: e.href, ...a })));
  const [annonceFaite, setAnnonceFaite] = useState(false);
  const pages = candidates.map((a) => [a.numero, a.href, a.vuSur ?? '', a.surPlace ? '1' : ''].join(' ')).join('|');
  useEffect(() => {
    const relire = () => {
      try {
        const cle = (k: string) => `${CLE_GUIDE}-${k}`;
        for (const [n, href, vuSur, surPlace] of pages.split('|').filter(Boolean).map((x) => x.split(' '))) {
          const ici = chemin.startsWith(href);
          // Page ouverte (celle qui le fait disparaître) : fini pour de bon dans cet onglet.
          if ((vuSur && chemin.startsWith(vuSur)) || (!vuSur && !surPlace && ici)) sessionStorage.setItem(cle('annonce-faite'), '1');
          // Montré aussi sur sa page : fini pour cette visite une fois la page quittée.
          if (surPlace && ici) sessionStorage.setItem(cle(`passe-${n}`), '1');
          if (surPlace && !ici && sessionStorage.getItem(cle(`passe-${n}`)) === '1') sessionStorage.setItem(cle('annonce-faite'), '1');
        }
        setAnnonceFaite(sessionStorage.getItem(cle('annonce-faite')) === '1');
      } catch { /* sans sessionStorage : comme avant, le serveur s'en charge au rechargement */ }
    };
    relire();
    // Page ouverte dans un autre onglet (pense-bête) : le lien prévient le menu.
    window.addEventListener('pat-annonce-vue', relire);
    return () => window.removeEventListener('pat-annonce-vue', relire);
  }, [chemin, pages]);
  const annonce = premiersPasEnCours || annonceFaite ? undefined : candidates
    .filter((a) => a.surPlace || !chemin.startsWith(a.href))
    .sort((a, b) => a.numero - b.numero)[0];
  // Sur sa page, un post-it avec une ancre (pense-bête) se pose à côté du bouton, pas de l'entrée du menu.
  const ancre = annonce?.ancre && chemin.startsWith(annonce.href) ? annonce.ancre : undefined;
  const guide: Guide | null = premiersPas ?? (annonce ? {
    href: annonce.href, numero: annonce.numero, ...(ancre ? { place: 'ancre' as const, ancre } : {}), postIt: true, texte: annonce.texte,
    // Un clic le ferme, entourage compris, jusqu'à la visite suivante.
    fermer: () => {
      try { sessionStorage.setItem(`${CLE_GUIDE}-annonce-faite`, '1'); } catch { /* rien */ }
      setAnnonceFaite(true);
    },
  } : null);
  const suivante = guide?.place === 'ancre' ? undefined : guide?.href;
  return { chemin, courant, guide, suivante };
}

/** Liens du menu de gauche ; l'étape ouverte est mise en évidence. */
export function NavLiens({ accueil, etapes, admin }: { accueil: string; etapes: Etape[]; admin?: { href: string; libelle: string }[] }) {
  const { courant, guide, suivante } = useMenu(accueil, etapes);
  // Groupes repliables (flèche à côté du titre) : en entrant dans l'espace, tous repliés sauf celui de la page ouverte ;
  // ceux qu'on ouvre ou ferme restent ainsi pendant la visite (pas d'un jour à l'autre).
  const [replies, setReplies] = useState<Record<string, boolean>>({});
  // Groupe de la page ouverte : déplié d'office, mais on peut quand même le replier (pour cette visite).
  const [fermesIci, setFermesIci] = useState<Record<string, boolean>>({});
  // Partie dont toutes les entrées sont grisées (Quid Vinum pendant l'inscription) : en-tête grisé, avec le message au survol.
  const marqueGrisee = (m?: string) => Boolean(m && etapes.filter((x) => x.marque === m).every((x) => x.desactive));
  // Groupe repliable d'une entrée : son sous-groupe chez Pat le sommelier (Carte et menu…), toute la partie Quid Vinum.
  const groupeDe = (e: Etape) => (e.marque === 'qv' ? 'Quid Vinum' : e.groupe);
  const groupeOuvert = (g: string) => etapes.some((e) => groupeDe(e) === g && (courant(e.href) || e.href === suivante));
  const cache = (g?: string) => Boolean(g && (groupeOuvert(g) ? fermesIci[g] : replies[g] ?? true));
  const basculer = (g: string) => {
    const replier = !cache(g);
    if (groupeOuvert(g)) setFermesIci((f) => ({ ...f, [g]: replier }));
    setReplies((r) => ({ ...r, [g]: replier }));
  };
  const fleche = <svg className="fleche-section" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
  // Point rouge sur un groupe replié qui cache une notification (commandes).
  const pointNotif = (g: string) => cache(g) && etapes.some((x) => groupeDe(x) === g && (x.notif?.n ?? 0) > 0) && <span className="point-notif" aria-label="Nouveauté" />;
  return (
    <nav aria-label="Back-office" className="bo-liens">
      {/* Deux parties, comme la page d'accueil de quidvinum.com : Pat le sommelier (carte et menu, app client, impression),
          puis Quid Vinum (la cave), dans un bloc bordeaux (grisé tant que la cave n'est pas ouverte). Sous-titres discrets,
          entrées toujours visibles (plus de groupes à dérouler). */}
      {blocs(etapes).map((bloc) => {
        const grisee = marqueGrisee(bloc.marque);
        const info = grisee ? bloc.etapes[0].desactive : undefined;
        // Quid Vinum replié, ou grisé (la cave n'est pas encore ouverte : il ne se déroule pas, comme avant) : ses entrées cachées.
        const qvCache = bloc.marque === 'qv' && (grisee || cache('Quid Vinum'));
        const entrees = qvCache ? null : bloc.etapes.map((e, i) => {
          const avant = bloc.etapes[i - 1];
          return (
            <Fragment key={e.href}>
              {/* Groupes de Pat le sommelier : titres en capitales qui se déroulent, comme le menu initial. */}
              {bloc.marque === 'pat' && e.groupe && e.groupe !== avant?.groupe && (
                <button type="button" className="section section-repliable" aria-expanded={!cache(e.groupe)} onClick={() => basculer(e.groupe!)}>
                  {e.groupe}{pointNotif(e.groupe)}{fleche}
                </button>)}
              {bloc.marque === 'pat' && cache(e.groupe) ? null : e.desactive ? (
                <span className="bo-lien bo-lien-desactive" aria-disabled="true" tabIndex={0} data-info={e.desactive} title={e.desactive}>
                  {e.icone && <span className="bo-num" style={{ border: 0 }}><Icone nom={e.icone} /></span>}
                  <span>{e.libelle}</span>
                </span>
              ) : (
                <Link href={e.href} className={`bo-lien${e.href === suivante ? ' cible-etape' : ''}${!bloc.marque ? ' bo-lien-seul' : ''}`}
                  aria-current={courant(e.href)} id={e.href === suivante ? 'lien-etape-suivante' : undefined}>
                  <span className="bo-num" style={{ border: 0 }}>{e.icone && <Icone nom={e.icone} />}</span>
                  {e.libelle}
                  {e.notif && <PastilleNotif initial={e.notif.n} source={e.notif.source} page={e.href} />}
                </Link>
              )}
            </Fragment>
          );
        });
        if (!bloc.marque) return <Fragment key={bloc.etapes[0].href}>{entrees}</Fragment>;
        const logo = (
          <span className="titre-marque-nom">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bloc.marque === 'pat' ? '/pat/pat-avatar-creme.svg' : '/quidvinum/icone.png'} alt="" aria-hidden="true" />
            <span>{bloc.marque === 'pat' ? 'Pat le sommelier' : 'Quid Vinum'}</span>
          </span>
        );
        return (
          <Fragment key={bloc.marque}>
            {bloc.marque === 'pat' ? (
              // Pat le sommelier : son nom ouvre la page d'accueil de l'espace (les informations générales du sommelier).
              <Link href={accueil} className="titre-marque titre-pat" aria-current={courant(accueil)}>{logo}</Link>
            ) : grisee ? (
              <span className="titre-marque titre-qv section-desactivee" aria-disabled="true" tabIndex={0} data-info={info} title={info}>{logo}</span>
            ) : (
              // Quid Vinum : titre qui se déroule, comme l'ancienne « Gestion de cave ».
              <button type="button" className="titre-marque titre-qv" aria-expanded={!cache('Quid Vinum')} onClick={() => basculer('Quid Vinum')}>
                {logo}
                {/* « Nouveau » (la cave vient de s'ouvrir) : à côté du titre. */}
                {bloc.etapes.some((x) => x.nouveau) && <span className="badge-nouveau badge-groupe">Nouveau</span>}
                {pointNotif('Quid Vinum')}{fleche}
              </button>
            )}
            {entrees}
          </Fragment>
        );
      })}
      {guide?.postIt && <BulleEtape guide={guide} />}
      {admin?.length ? <div className="section">Pat</div> : null}
      {admin?.map((l) => <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}><span className="bo-num" style={{ border: 0 }}><Icone nom="users" /></span>{l.libelle}</Link>)}
    </nav>
  );
}

/** Onglets du menu du haut : les groupes de Pat le sommelier, puis la Gestion de cave (Quid Vinum). */
function onglets(etapes: Etape[]) {
  const r: { nom: string; etapes: Etape[] }[] = [];
  for (const e of etapes) {
    const nom = e.marque === 'qv' ? e.groupe ?? 'Gestion de cave' : e.marque === 'pat' ? e.groupe : undefined;
    if (!nom) continue;
    const o = r.find((x) => x.nom === nom);
    if (o) o.etapes.push(e); else r.push({ nom, etapes: [e] });
  }
  return r;
}

/**
 * Menu du haut d'un restaurant : à gauche son logo (vers l'accueil de l'espace) et son statut ; puis les onglets, chacun avec
 * son menu déroulant (Cartes et menus, App client, Impression, Gestion de cave, Frigos connectés s'il y en a) ; à droite les paramètres et le compte.
 * L'onglet de la page ouverte est mis en évidence ; celui que montre un post-it est entouré, le post-it dessous.
 */
export function NavHaut({ accueil, etapes, resto, statut, compte }: {
  accueil: string; etapes: Etape[];
  resto: { nom: string; couleur: string; logo?: string | null };
  statut?: { couleur: string; libelle: string } | null;
  /** Menu du compte (roue) : paramètres, super-admin, changer de restaurant, e-mail et déconnexion. */
  compte: { liens: { href: string; libelle: string }[]; email: string; deconnexion: React.ReactNode };
}) {
  const { chemin, courant, guide, suivante } = useMenu(accueil, etapes);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const barre = useRef<HTMLElement>(null);
  // Un menu ouvert se ferme en changeant de page, en cliquant ailleurs ou avec Échap.
  useEffect(() => { setOuvert(null); }, [chemin]);
  useEffect(() => {
    if (!ouvert) return;
    const ailleurs = (ev: MouseEvent) => { if (!barre.current?.contains(ev.target as Node)) setOuvert(null); };
    const echap = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOuvert(null); };
    document.addEventListener('mousedown', ailleurs);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', ailleurs); document.removeEventListener('keydown', echap); };
  }, [ouvert]);
  const fleche = <svg className="fleche-onglet" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
  const basculer = (nom: string) => setOuvert((o) => (o === nom ? null : nom));
  return (
    <header className="bo-haut" ref={barre}>
      <Link href={accueil} className="haut-resto" aria-label={`${resto.nom} : accueil de votre espace`} aria-current={courant(accueil)}>
        {resto.logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <span className="haut-resto-logo" style={{ background: resto.couleur }}><img src={resto.logo} alt={resto.nom} /></span>
          : <span className="haut-resto-logo" style={{ background: resto.couleur }}><b>{resto.nom}</b></span>}
        {statut && <span className="haut-statut"><span className="rond-mode" style={{ background: statut.couleur }} aria-hidden="true" />{statut.libelle}</span>}
      </Link>
      <nav aria-label="Menu principal" className="haut-onglets">
        {onglets(etapes).map((o) => {
          const grise = o.etapes.every((e) => e.desactive);
          const actif = o.etapes.some((e) => courant(e.href));
          const montre = o.etapes.some((e) => e.href === suivante);
          const notif = o.etapes.some((e) => (e.notif?.n ?? 0) > 0);
          if (grise) return (
            <span key={o.nom} className="haut-onglet section-desactivee" aria-disabled="true" tabIndex={0} data-info={o.etapes[0].desactive} title={o.etapes[0].desactive}>
              <span>{o.nom}</span>
            </span>);
          return (
            <div key={o.nom} className="haut-groupe">
              <button type="button" className={`haut-onglet${actif ? ' actif' : ''}${montre ? ' cible-etape' : ''}`} aria-expanded={ouvert === o.nom}
                onClick={() => basculer(o.nom)} id={montre ? 'lien-etape-suivante' : undefined}>
                {o.nom}
                {o.etapes.some((e) => e.nouveau) && <span className="badge-nouveau badge-groupe">Nouveau</span>}
                {notif && <span className="point-notif" aria-label="Nouveauté" />}
                {fleche}
              </button>
              {ouvert === o.nom && (
                <div className="haut-deroulant">
                  {o.etapes.map((e) => e.desactive ? (
                    <span key={e.href} className="bo-lien bo-lien-desactive" aria-disabled="true" tabIndex={0} data-info={e.desactive} title={e.desactive}>
                      {e.icone && <span className="bo-num" style={{ border: 0 }}><Icone nom={e.icone} /></span>}
                      <span>{e.libelle}</span>
                    </span>
                  ) : (
                    <Link key={e.href} href={e.href} className={`bo-lien${e.href === suivante ? ' cible-etape' : ''}`} aria-current={courant(e.href)}>
                      <span className="bo-num" style={{ border: 0 }}>{e.icone && <Icone nom={e.icone} />}</span>
                      {e.libelle}
                      {e.notif && <PastilleNotif initial={e.notif.n} source={e.notif.source} page={e.href} />}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="haut-droite">
        <div className="haut-groupe">
          <button type="button" className="haut-roue" aria-expanded={ouvert === 'compte'} aria-label="Paramètres et compte" onClick={() => basculer('compte')}>
            <Icone nom="reglages" />
          </button>
          {ouvert === 'compte' && (
            <div className="haut-deroulant haut-deroulant-droite">
              {compte.liens.map((l) => (
                <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}>{l.libelle}</Link>
              ))}
              <span className="haut-email">{compte.email}</span>
              {compte.deconnexion}
            </div>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/quidvinum/logo.png" alt="Quid Vinum" className="haut-logo-qv" />
      </div>
      {guide?.postIt && <BulleEtape guide={guide} />}
    </header>
  );
}

/** Fil d'Ariane sous le menu du haut : « Cartes et menus › Gérer la carte des vins ». */
export function FilAriane({ accueil, etapes }: { accueil: string; etapes: Etape[] }) {
  // Même repérage que le menu (sans ses post-its) : fiche d'un vin ouverte depuis Ma cave, producteur, « Ajouter un vin ».
  const sp = useSearchParams();
  let chemin = usePathname();
  const retour = sp?.get('retour') ?? '';
  if (/^\/admin\/[^/]+\/carte\/[^/]+$/.test(chemin) && /^\/admin\/[^/]+\/stocks/.test(retour)) chemin = retour.split('?')[0];
  if (/^\/admin\/[^/]+\/producteurs\//.test(chemin)) chemin = chemin.replace(/\/producteurs\/.*$/, '/stocks');
  chemin = chemin.replace(/\/trouver-vin(\/.*)?$/, '/carte');
  if (chemin === accueil) return null;
  const e = etapes.filter((x) => chemin.startsWith(x.href)).sort((a, b) => b.href.length - a.href.length)[0];
  if (!e) return null;
  const groupe = e.marque === 'qv' ? e.groupe ?? 'Gestion de cave' : e.groupe;
  return <p className="fil-ariane">{groupe ? `${groupe} › ` : ''}{e.libelle}</p>;
}

/** Entrées regroupées par partie (Pat le sommelier, Quid Vinum, puis les entrées seules), dans l'ordre. */
function blocs(etapes: Etape[]) {
  const r: { marque?: Etape['marque']; etapes: Etape[] }[] = [];
  for (const e of etapes) {
    const dernier = r[r.length - 1];
    if (dernier && dernier.marque === e.marque) dernier.etapes.push(e); else r.push({ marque: e.marque, etapes: [e] });
  }
  return r;
}

type Guide = { href: string; numero: number; titre?: string; texte: string; postIt: boolean; fermer: () => void; place?: 'menu' | 'haut-droite' | 'ancre'; ancre?: string };
const CLE_GUIDE = 'pat-guide-chevalet';
/** Attente avant le post-it : le temps d'essayer le simulateur (étape 2), puis la carte des vins (étape 3). */
const ATTENTE: Record<2 | 3, number> = { 2: 60_000, 3: 120_000 };

/**
 * Premiers pas, retenus pour la visite (cet onglet) :
 * - arrivée dans le simulateur après l'inscription (?bienvenue=1) → étape 2, « Vérifiez votre carte des vins » ;
 * - carte des vins ouverte (par le post-it ou par le menu) → étape 3, « Imprimez votre chevalet de table » ;
 * - chevalet ouvert → fini.
 * Pendant une étape : rien la première minute (deux pour l'étape 3), puis l'entrée du menu est entourée et un post-it
 * apparaît à côté ; un clic sur le post-it le ferme, l'entrée reste entourée jusqu'à ce qu'on l'ouvre.
 */
function useGuide(chemin: string, bienvenue: boolean, etapes: Etape[]): [Guide | null, boolean] {
  const carte = etapes.find((e) => /\/carte$/.test(e.href))?.href;
  const chevalet = etapes.find((e) => /\/chevalet$/.test(e.href))?.href;
  const [etat, setEtat] = useState<{ numero: 2 | 3; visible: boolean; ferme: boolean; accueil: boolean } | null>(null);
  const [fermes, setFermes] = useState(0); // relance l'effet quand on ferme le post-it
  // Premiers pas faits pendant cette visite (même finis) : les autres post-its attendent la visite suivante.
  const [guideIci, setGuideIci] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      const lire = (k: string) => sessionStorage.getItem(`${CLE_GUIDE}-${k}`);
      const ecrire = (k: string, v: string) => sessionStorage.setItem(`${CLE_GUIDE}-${k}`, v);
      let etape = lire('etape');
      setGuideIci(Boolean(etape) || bienvenue);
      if (chevalet && chemin.startsWith(chevalet)) { if (etape === '2' || etape === '3') ecrire('etape', 'fini'); etape = 'fini'; }
      else if (carte && chemin === carte && (etape === '2' || etape === '3' || bienvenue)) {
        if (etape !== '3') { ecrire('etape', '3'); ecrire('debut-3', String(Date.now())); etape = '3'; }
      } else if (bienvenue && /\/simulateur$/.test(chemin) && !etape) { ecrire('etape', '2'); ecrire('debut-2', String(Date.now())); etape = '2'; }
      if (etape !== '2' && etape !== '3') { setEtat(null); return; }
      const numero = Number(etape) as 2 | 3;
      const reste = Number(lire(`debut-${numero}`) ?? Date.now()) + ATTENTE[numero] - Date.now();
      const ferme = lire(`ferme-${numero}`) === '1';
      // Étape 1 : à l'arrivée dans le simulateur, en attendant le post-it 2 (sauf s'il a été fermé).
      const accueil = numero === 2 && /\/simulateur$/.test(chemin) && lire('ferme-1') !== '1';
      setEtat({ numero, visible: reste <= 0, ferme, accueil });
      if (reste > 0) t = setTimeout(() => setEtat({ numero, visible: true, ferme, accueil: false }), reste);
    } catch { setEtat(null); }
    return () => clearTimeout(t);
  }, [chemin, bienvenue, carte, chevalet, fermes]);
  const fermer = (n: number) => () => {
    try {
      sessionStorage.setItem(`${CLE_GUIDE}-ferme-${n}`, '1');
      // Post-it 1 fermé : la minute avant l'étape 2 (post-it et entrée entourée) repart de ce moment.
      if (n === 1) sessionStorage.setItem(`${CLE_GUIDE}-debut-2`, String(Date.now()));
    } catch { /* rien */ }
    setFermes((x) => x + 1);
  };
  // Second élément : premiers pas en cours (étape 2 ou 3, post-it affiché ou attendu).
  if (etat && !etat.visible && etat.accueil) return [{
    href: '', numero: 1, place: 'haut-droite', postIt: true, fermer: fermer(1),
    titre: 'Bienvenue dans le simulateur', texte: 'Testez l’application comme si vous étiez un client du restaurant.',
  }, true];
  if (!etat?.visible) return [null, Boolean(etat) || guideIci];
  const href = etat.numero === 2 ? carte : chevalet;
  if (!href) return [null, true];
  return [{
    href, numero: etat.numero, postIt: !etat.ferme,
    texte: etat.numero === 2 ? 'Vérifiez votre carte des vins' : 'Imprimez votre chevalet de table',
    fermer: fermer(etat.numero),
  }, true];
}

/**
 * Post-it « étape suivante » des premiers pas : collé à côté de l'entrée du menu visée (à sa droite ; dessous sur
 * téléphone). Un clic le ferme ; l'entrée reste entourée.
 */
function BulleEtape({ guide }: { guide: Guide }) {
  const [pos, setPos] = useState<{ top: number; left: number; largeur: number; cote: 'droite' | 'dessous' | 'haut' } | null>(null);
  useEffect(() => {
    const placer = () => {
      if (guide.place === 'ancre' && guide.ancre) {
        // Sous l'élément de la page (ex. le bouton « Imprimer le pense-bête »), flèche vers le haut.
        const r = document.getElementById(guide.ancre)?.getBoundingClientRect();
        if (!r || !r.height) { setPos(null); return; }
        const largeur = Math.min(280, window.innerWidth - 32);
        const left = Math.min(Math.max(16, r.left + window.scrollX), document.documentElement.clientWidth - largeur - 16);
        setPos({ top: r.bottom + window.scrollY + 12, left, largeur, cote: 'dessous' });
        return;
      }
      if (guide.place === 'haut-droite') {
        // Sur le téléphone du simulateur, à cheval sur son bord droit ; sans téléphone, en haut à droite de la page.
        const largeur = Math.min(290, window.innerWidth - 32);
        const tel = document.querySelector('iframe[title="Aperçu de l’app client"]')?.getBoundingClientRect();
        if (tel && tel.width) {
          const left = Math.min(tel.right + window.scrollX - 70, document.documentElement.clientWidth - largeur - 12);
          setPos({ top: tel.top + window.scrollY + 280, left: Math.max(12, left), largeur, cote: 'haut' });
        } else setPos({ top: 14, left: document.documentElement.clientWidth - largeur - 18, largeur, cote: 'haut' });
        return;
      }
      const cible = document.getElementById('lien-etape-suivante');
      const r = cible?.getBoundingClientRect();
      // Menu du haut : le post-it sous l'onglet entouré.
      if (cible?.closest('.bo-haut') && r && r.height) {
        const largeur = Math.min(280, window.innerWidth - 32);
        setPos({ top: r.bottom + window.scrollY + 12, left: Math.min(Math.max(16, r.left + window.scrollX), document.documentElement.clientWidth - largeur - 16), largeur, cote: 'dessous' });
        return;
      }
      const nav = document.querySelector('.bo-nav, .bo-gauche')?.getBoundingClientRect();
      if (!r || !r.height || !nav) { setPos(null); return; }
      const largeur = Math.min(260, window.innerWidth - 32);
      const aDroite = nav.right + largeur + 24 <= document.documentElement.clientWidth && nav.width < window.innerWidth * 0.6;
      setPos(aDroite
        ? { top: r.top + window.scrollY + r.height / 2 - 52, left: nav.right + window.scrollX + 14, largeur, cote: 'droite' }
        : { top: r.bottom + window.scrollY + 10, left: Math.max(16, r.left + window.scrollX + 8), largeur, cote: 'dessous' });
    };
    placer();
    const t = setTimeout(placer, 300); // après le dépliage du groupe
    window.addEventListener('resize', placer);
    return () => { clearTimeout(t); window.removeEventListener('resize', placer); };
  }, [guide.href, guide.place, guide.ancre]);
  if (!pos) return null;
  return createPortal(
    <button type="button" onClick={guide.fermer} className={`post-it-etape ${pos.cote}`} style={{ top: pos.top, left: pos.left, width: pos.largeur }}
      title="Cliquez pour fermer" aria-label={`${guide.titre ?? 'Étape suivante'} : ${guide.texte} Fermer`}>
      {guide.titre
        ? <span className="pile" style={{ gap: 4, textAlign: 'left' }}><b>{guide.titre}</b><span style={{ fontSize: 15 }}>{guide.texte}</span></span>
        : <span className="pile" style={{ gap: 4, textAlign: 'left' }}><small>Votre étape suivante</small><b>{guide.texte}</b><span className="post-it-suite">{pos.cote === 'droite' ? '← C’est ici' : '↑ C’est ici'}</span></span>}
      <span className="post-it-fermer" aria-hidden="true">✕</span>
    </button>, document.body);
}

/**
 * Menu de gauche d'un restaurant, façon HubSpot : une colonne bordeaux avec le logo du restaurant (sur une carte blanche) et
 * son statut, puis chaque partie (Cartes et menus, App client, Impression, Gestion de cave, Frigos connectés) et toutes ses
 * entrées, toujours visibles ; en bas les paramètres, le compte et Quid Vinum.
 */
export function NavGauche({ accueil, etapes, resto, compte }: {
  accueil: string; etapes: Etape[];
  resto: { nom: string; couleur: string; logo?: string | null };
  compte: { liens: { href: string; libelle: string }[]; email: string; deconnexion: React.ReactNode };
}) {
  const { chemin, courant, guide, suivante } = useMenu(accueil, etapes);
  const [compteOuvert, setCompteOuvert] = useState(false);
  // Sur le téléphone, le menu est replié derrière un bouton « Menu » ; il se replie en changeant de page.
  const [menuOuvert, setMenuOuvert] = useState(false);
  useEffect(() => { setMenuOuvert(false); setCompteOuvert(false); }, [chemin]);
  return (
    <aside className={`bo-gauche${menuOuvert ? ' menu-ouvert' : ''}`}>
      <button type="button" className="gauche-bascule" aria-expanded={menuOuvert} onClick={() => setMenuOuvert((x) => !x)}>
        <Icone nom="burger" /> Menu
      </button>
      {/* En haut de la colonne : le logo du restaurant (vers l'accueil) ; son statut est en haut à droite de la page. */}
      <Link href={accueil} className="haut-resto gauche-resto" aria-label={`${resto.nom} : accueil de votre espace`}>
        {resto.logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <span className="haut-resto-logo" style={{ background: resto.couleur }}><img src={resto.logo} alt={resto.nom} /></span>
          : <span className="haut-resto-logo" style={{ background: resto.couleur }}><b>{resto.nom}</b></span>}
      </Link>
      <nav aria-label="Menu principal" className="gauche-menu">
        {/* La page d'accueil du restaurant (ses chiffres clés), sous son nom, au-dessus des parties. */}
        <div className="gauche-partie">
          <Link href={accueil} className="bo-lien" aria-current={courant(accueil)}>
            <span className="bo-num" style={{ border: 0 }}><Icone nom="home" /></span>{resto.nom}
          </Link>
        </div>
        {onglets(etapes).map((o) => (
          <div key={o.nom} className="gauche-partie">
            <p className="gauche-titre">{o.nom}{o.etapes.some((e) => e.nouveau) && <span className="badge-nouveau badge-groupe">Nouveau</span>}</p>
            {o.etapes.map((e) => e.desactive ? (
              <span key={e.href} className="bo-lien bo-lien-desactive section-desactivee" aria-disabled="true" tabIndex={0} data-info={e.desactive} title={e.desactive}>
                <span className="bo-num" style={{ border: 0 }}>{e.icone && <Icone nom={e.icone} />}</span><span>{e.libelle}</span>
              </span>
            ) : (
              <Link key={e.href} href={e.href} className={`bo-lien${e.href === suivante ? ' cible-etape' : ''}`} aria-current={courant(e.href)}
                id={e.href === suivante ? 'lien-etape-suivante' : undefined}>
                <span className="bo-num" style={{ border: 0 }}>{e.icone && <Icone nom={e.icone} />}</span>
                {e.libelle}
                {e.notif && <PastilleNotif initial={e.notif.n} source={e.notif.source} page={e.href} />}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="gauche-bas">
        <button type="button" className="bo-lien gauche-compte" aria-expanded={compteOuvert} onClick={() => setCompteOuvert((x) => !x)}>
          <span className="bo-num" style={{ border: 0 }}><Icone nom="reglages" /></span>Paramètres et compte
        </button>
        {compteOuvert && (
          <div className="gauche-compte-liens">
            {compte.liens.map((l) => <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}>{l.libelle}</Link>)}
            <span className="haut-email">{compte.email}</span>
            {compte.deconnexion}
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/quidvinum/logo.png" alt="Quid Vinum" className="haut-logo-qv gauche-logo-qv" />
      </div>
      {guide?.postIt && <BulleEtape guide={guide} />}
    </aside>
  );
}
