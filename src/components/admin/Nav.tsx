'use client';
import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icone } from './Icone';
import { PastilleNotif } from './PastilleNotif';

export type EtatEtape = 'fait' | 'encours' | 'afaire';
/** Étape du menu de gauche, rangée sous son groupe ; un outil (icône) n'est pas une étape à cocher. */
export interface Etape { href: string; libelle: string; etat: EtatEtape; groupe?: string; icone?: string;
  /** Pastille de notification : nombre au chargement et adresse qui le relit. */
  notif?: { n: number; source: string };
  /** Entrée qui vient d'apparaître (la Gestion de cave après le premier client) : pastille « Nouveau ». */
  nouveau?: boolean }


/** Liens du menu de gauche ; l'étape ouverte est mise en évidence. */
export function NavLiens({ accueil, etapes, admin }: { accueil: string; etapes: Etape[]; admin?: { href: string; libelle: string }[] }) {
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
  // Premiers pas après l'inscription, une bulle sur l'entrée du menu de l'étape suivante (son groupe est déplié) :
  // 2. dans le simulateur (?bienvenue=1) : « Vérifiez votre carte des vins » ;
  // 3. puis dans la carte des vins (arrivé par la bulle 2, retenu pour cette visite) : « Imprimez votre chevalet de table ».
  const guide = useGuide(chemin, sp?.get('bienvenue') === '1', etapes);
  const suivante = guide?.href;
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
      {etapes.map((e, i) => (
        <Fragment key={e.href}>
          {e.groupe && e.groupe !== etapes[i - 1]?.groupe && (
            <button type="button" className="section section-repliable" aria-expanded={!cache(e.groupe)} onClick={() => basculer(e.groupe!)}>
              {e.groupe}
              {/* Groupe replié qui cache une notification (commandes) : un point rouge le signale. */}
              {cache(e.groupe) && etapes.some((x) => x.groupe === e.groupe && ((x.notif?.n ?? 0) > 0 || x.nouveau)) && <span className="point-notif" aria-label="Nouveauté" />}
              <svg className="fleche-section" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>)}
          {!cache(e.groupe) && <Link href={e.href} className="bo-lien" aria-current={courant(e.href)} id={e.href === suivante ? 'lien-etape-suivante' : undefined}>
            {e.icone ? <span className="bo-num" style={{ border: 0 }}><Icone nom={e.icone} /></span> : (
              <span className={`bo-num ${e.etat}`} aria-label={e.etat === 'fait' ? 'Terminé' : undefined}>
                {e.etat === 'fait' ? <Icone nom="check" taille={14} epaisseur={2.4} /> : i + 1}
              </span>
            )}
            {e.libelle}
            {e.nouveau && <span className="badge-nouveau">Nouveau</span>}
            {e.notif && <PastilleNotif initial={e.notif.n} source={e.notif.source} page={e.href} />}
          </Link>}

        </Fragment>
      ))}
      {guide && <BulleEtape guide={guide} />}
      {admin?.length ? <div className="section">Pat</div> : null}
      {admin?.map((l) => <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}><span className="bo-num" style={{ border: 0 }}><Icone nom="users" /></span>{l.libelle}</Link>)}
    </nav>
  );
}

type Guide = { href: string; lien: string; numero: number; texte: string };
const CLE_GUIDE = 'pat-guide-chevalet';

/** L'étape suivante des premiers pas, selon la page ouverte (voir NavLiens). */
function useGuide(chemin: string, bienvenue: boolean, etapes: Etape[]): Guide | null {
  const carte = etapes.find((e) => /\/carte$/.test(e.href))?.href;
  const chevalet = etapes.find((e) => /\/chevalet$/.test(e.href))?.href;
  const surCarte = Boolean(carte && chemin === carte);
  const [etape3, setEtape3] = useState(false);
  // Retenu pour la visite (cet onglet) : '2' quand la bulle 2 a été montrée dans le simulateur ; sur la carte des vins,
  // par la bulle ou par le menu, on passe à '3' ; le chevalet ouvert, les premiers pas sont finis.
  useEffect(() => {
    try {
      if (chevalet && chemin.startsWith(chevalet)) { sessionStorage.setItem(CLE_GUIDE, 'fini'); setEtape3(false); return; }
      const avant = sessionStorage.getItem(CLE_GUIDE);
      if (bienvenue && /\/simulateur$/.test(chemin) && avant !== 'fini' && avant !== '3') sessionStorage.setItem(CLE_GUIDE, '2');
      const montre = surCarte && (bienvenue || avant === '2' || avant === '3');
      if (montre) sessionStorage.setItem(CLE_GUIDE, '3');
      setEtape3(montre);
    } catch { setEtape3(surCarte && bienvenue); }
  }, [chemin, bienvenue, surCarte, chevalet]);
  if (bienvenue && /\/simulateur$/.test(chemin) && carte) return { href: carte, lien: `${carte}?bienvenue=1`, numero: 2, texte: 'Vérifiez votre carte des vins' };
  if (etape3 && chevalet) return { href: chevalet, lien: chevalet, numero: 3, texte: 'Imprimez votre chevalet de table' };
  return null;
}

/**
 * Post-it « étape suivante » des premiers pas : collé à côté de l'entrée du menu visée, qui est entourée.
 * Un clic sur le post-it y mène.
 */
function BulleEtape({ guide }: { guide: Guide }) {
  const [pos, setPos] = useState<{ top: number; left: number; largeur: number; cote: 'droite' | 'dessous' } | null>(null);
  useEffect(() => {
    const placer = () => {
      // À côté de l'entrée du menu visée (à sa droite, à sa hauteur) ; dessous quand le menu prend toute la largeur (téléphone).
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
  }, [guide.href]);
  // L'entrée du menu visée : entourée tant que le post-it est là.
  useEffect(() => {
    const lien = document.getElementById('lien-etape-suivante');
    lien?.classList.add('cible-etape');
    return () => lien?.classList.remove('cible-etape');
  });
  if (!pos) return null;
  return createPortal(
    <Link href={guide.lien} className={`post-it-etape ${pos.cote}`} style={{ top: pos.top, left: pos.left, width: pos.largeur }}>
      <span className="post-it-numero" aria-hidden="true">{guide.numero}</span>
      <span className="pile" style={{ gap: 4 }}><small>Votre étape suivante</small><b>{guide.texte}</b><span className="post-it-suite">{pos.cote === 'droite' ? '← C’est ici' : '↑ C’est ici'}</span></span>
    </Link>, document.body);
}
