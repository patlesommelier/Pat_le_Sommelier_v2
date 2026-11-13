'use client';
import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icone } from './Icone';
import { PastilleNotif } from './PastilleNotif';
import { MODES, type ModeRestaurant } from '@/lib/admin/prochaine-etape';

export type EtatEtape = 'fait' | 'encours' | 'afaire';
/** Étape du menu de gauche, rangée sous son groupe ; un outil (icône) n'est pas une étape à cocher. */
export interface Etape { href: string; libelle: string; etat: EtatEtape; groupe?: string; icone?: string;
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


/** Liens du menu de gauche ; l'étape ouverte est mise en évidence. */
export function NavLiens({ accueil, etapes, admin, mode }: { accueil: string; etapes: Etape[]; admin?: { href: string; libelle: string }[]; mode?: string }) {
  const sp = useSearchParams();
  let chemin = usePathname();
  // Fiche d'un vin ouverte depuis Ma cave (?retour=…/stocks), fiche d'un producteur : on reste sur « Ma cave » dans le menu.
  const retour = sp?.get('retour') ?? '';
  if (/^\/admin\/[^/]+\/carte\/[^/]+$/.test(chemin) && /^\/admin\/[^/]+\/stocks/.test(retour)) chemin = retour.split('?')[0];
  if (/^\/admin\/[^/]+\/producteurs\//.test(chemin)) chemin = chemin.replace(/\/producteurs\/.*$/, '/stocks');
  const courant = (href: string) => (href === accueil ? chemin === href : chemin.startsWith(href)) ? 'page' : undefined;
  // Groupes repliables (flèche à côté du titre) : en entrant dans l'espace, tous repliés sauf celui de la page ouverte ;
  // ceux qu'on ouvre ou ferme restent ainsi pendant la visite (pas d'un jour à l'autre).
  const [replies, setReplies] = useState<Record<string, boolean>>({});
  // Groupe de la page ouverte : déplié d'office, mais on peut quand même le replier (pour cette visite).
  const [fermesIci, setFermesIci] = useState<Record<string, boolean>>({});
  // Premiers pas après l'inscription : l'entrée du menu de l'étape suivante est entourée (son groupe déplié) et un post-it
  // la montre, après un temps pour essayer la page (voir useGuide).
  const [premiersPas, premiersPasEnCours] = useGuide(chemin, sp?.get('bienvenue') === '1', etapes);
  // Post-its d'explication (visites suivantes) : le plus petit numéro d'abord ; aucun pendant la visite des premiers pas
  // (post-its 1 à 3, même une fois finis) : ils attendent la visite suivante.
  // Page montrée déjà ouverte : le post-it et l'entourage disparaissent tout de suite. Le menu (layout) n'est pas relu en
  // changeant de page : sans cela, l'entrée restait entourée jusqu'au prochain rechargement.
  const candidates = etapes.flatMap((e) => (e.annonces ?? []).map((a) => ({ href: e.href, ...a })));
  const numeros = candidates.map((a) => a.numero);
  const [annoncesVues, setAnnoncesVues] = useState<number[]>([]);
  // Un seul post-it par visite : une fois sa page ouverte, le suivant attend la visite d'après (sinon un nouveau post-it
  // apparaissait aussitôt, comme si le premier restait).
  const [annonceFaite, setAnnonceFaite] = useState(false);
  const pagesAnnoncees = candidates.map((a) => `${a.numero} ${a.vuSur ?? (a.surPlace ? '' : a.href)}`).join('|');
  useEffect(() => {
    const relire = () => {
      const vues = pagesAnnoncees.split('|').map((x) => x.split(' ')).filter(([, page]) => page && chemin.startsWith(page)).map(([n]) => n);
      try {
        vues.forEach((n) => sessionStorage.setItem(`${CLE_GUIDE}-vu-${n}`, '1'));
        if (vues.length) sessionStorage.setItem(`${CLE_GUIDE}-annonce-faite`, '1');
        setAnnonceFaite(sessionStorage.getItem(`${CLE_GUIDE}-annonce-faite`) === '1');
        setAnnoncesVues(pagesAnnoncees.split('|').map((x) => Number(x.split(' ')[0])).filter((n) => sessionStorage.getItem(`${CLE_GUIDE}-vu-${n}`) === '1'));
      } catch { setAnnoncesVues((v) => [...v, ...vues.map(Number)]); if (vues.length) setAnnonceFaite(true); }
    };
    relire();
    // Page ouverte dans un autre onglet (pense-bête) : le lien prévient le menu.
    window.addEventListener('pat-annonce-vue', relire);
    return () => window.removeEventListener('pat-annonce-vue', relire);
  }, [chemin, pagesAnnoncees]);
  const annonce = premiersPasEnCours || annonceFaite ? undefined : candidates
    .filter((a) => !annoncesVues.includes(a.numero) && (a.surPlace || !chemin.startsWith(a.href)))
    .sort((a, b) => a.numero - b.numero)[0];
  // Un clic le ferme pour cette visite ; l'entrée reste entourée, et il revient tant que la page n'a pas été ouverte.
  const [annoncesFermees, setAnnoncesFermees] = useState<number[]>([]);
  const listeNumeros = numeros.join(',');
  useEffect(() => {
    try { setAnnoncesFermees(listeNumeros.split(',').map(Number).filter((n) => sessionStorage.getItem(`${CLE_GUIDE}-ferme-${n}`) === '1')); } catch { /* rien */ }
  }, [listeNumeros]);
  // Sur sa page, un post-it avec une ancre (pense-bête) se pose à côté du bouton, pas de l'entrée du menu.
  const ancre = annonce?.ancre && chemin.startsWith(annonce.href) ? annonce.ancre : undefined;
  const guide: Guide | null = premiersPas ?? (annonce ? {
    href: annonce.href, numero: annonce.numero, ...(ancre ? { place: 'ancre' as const, ancre } : {}), postIt: !annoncesFermees.includes(annonce.numero), texte: annonce.texte,
    fermer: () => {
      const n = annonce.numero;
      setAnnoncesFermees((f) => [...f, n]);
      try { sessionStorage.setItem(`${CLE_GUIDE}-ferme-${n}`, '1'); } catch { /* rien */ }
    },
  } : null);
  const suivante = guide?.place === 'ancre' ? undefined : guide?.href;
  const groupeGrise = (g?: string) => Boolean(g && etapes.filter((x) => x.groupe === g).every((x) => x.desactive));
  const groupeOuvert = (g: string) => etapes.some((e) => e.groupe === g && (courant(e.href) || e.href === suivante));
  const cache = (g?: string) => Boolean(g && (groupeOuvert(g) ? fermesIci[g] : replies[g] ?? true));
  const basculer = (g: string) => {
    const replier = !cache(g);
    if (groupeOuvert(g)) setFermesIci((f) => ({ ...f, [g]: replier }));
    setReplies((r) => ({ ...r, [g]: replier }));
  };
  return (
    <nav aria-label="Back-office" className="bo-liens">
      <Link href={accueil} className="bo-lien" aria-current={courant(accueil)}><span className="bo-num" style={{ border: 0 }}><Icone nom="home" /></span>Tableau de bord</Link>
      {/* Statut de l'espace (choisi par Quid Vinum) : son nom seulement. */}
      {mode && MODES[mode as ModeRestaurant] && (
        <span className="statut-espace">
          <span className="rond-mode" style={{ background: MODES[mode as ModeRestaurant].couleur }} aria-hidden="true" />
          <b>{MODES[mode as ModeRestaurant].libelle}</b>
        </span>
      )}
      {etapes.map((e, i) => (
        <Fragment key={e.href}>
          {/* Groupe dont toutes les entrées sont grisées (Gestion de cave avant la validation de la carte) : titre grisé, qui ne
              se déroule pas, avec le message au survol. */}
          {e.groupe && e.groupe !== etapes[i - 1]?.groupe && groupeGrise(e.groupe) && (
            <span className="section section-desactivee" aria-disabled="true" tabIndex={0} data-info={e.desactive} title={e.desactive}>
              <span>{e.groupe}</span>
            </span>)}
          {e.groupe && e.groupe !== etapes[i - 1]?.groupe && !groupeGrise(e.groupe) && (
            <button type="button" className="section section-repliable" aria-expanded={!cache(e.groupe)} onClick={() => basculer(e.groupe!)}>
              {e.groupe}
              {/* Groupe replié qui cache une notification (commandes) : un point rouge le signale. */}
              {/* « Nouveau » (la Gestion de cave vient de s'ouvrir) : à côté du titre du groupe. */}
              {etapes.some((x) => x.groupe === e.groupe && x.nouveau) && <span className="badge-nouveau badge-groupe">Nouveau</span>}
              {cache(e.groupe) && etapes.some((x) => x.groupe === e.groupe && (x.notif?.n ?? 0) > 0) && <span className="point-notif" aria-label="Nouveauté" />}
              <svg className="fleche-section" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>)}
          {!cache(e.groupe) && !groupeGrise(e.groupe) && e.desactive && (
            <span className="bo-lien bo-lien-desactive" aria-disabled="true" tabIndex={0} data-info={e.desactive} title={e.desactive}>
              {e.icone && <span className="bo-num" style={{ border: 0 }}><Icone nom={e.icone} /></span>}
              <span>{e.libelle}</span>
            </span>
          )}
          {!cache(e.groupe) && !groupeGrise(e.groupe) && !e.desactive && <Link href={e.href} className={`bo-lien${e.href === suivante ? ' cible-etape' : ''}${!e.groupe && etapes[i - 1]?.groupe ? ' bo-lien-seul' : ''}`} aria-current={courant(e.href)} id={e.href === suivante ? 'lien-etape-suivante' : undefined}>
            {e.icone ? <span className="bo-num" style={{ border: 0 }}><Icone nom={e.icone} /></span> : (
              <span className={`bo-num ${e.etat}`} aria-label={e.etat === 'fait' ? 'Terminé' : undefined}>
                {e.etat === 'fait' ? <Icone nom="check" taille={14} epaisseur={2.4} /> : i + 1}
              </span>
            )}
            {e.libelle}
            {e.notif && <PastilleNotif initial={e.notif.n} source={e.notif.source} page={e.href} />}
          </Link>}

        </Fragment>
      ))}
      {guide?.postIt && <BulleEtape guide={guide} />}
      {admin?.length ? <div className="section">Pat</div> : null}
      {admin?.map((l) => <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}><span className="bo-num" style={{ border: 0 }}><Icone nom="users" /></span>{l.libelle}</Link>)}
    </nav>
  );
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
      const r = document.getElementById('lien-etape-suivante')?.getBoundingClientRect();
      const nav = document.querySelector('.bo-nav')?.getBoundingClientRect();
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
