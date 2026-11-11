'use client';
import { Fragment, useState } from 'react';
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
  const groupeOuvert = (g: string) => etapes.some((e) => e.groupe === g && courant(e.href));
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
          {!cache(e.groupe) && <Link href={e.href} className="bo-lien" aria-current={courant(e.href)}>
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
      {admin?.length ? <div className="section">Pat</div> : null}
      {admin?.map((l) => <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}><span className="bo-num" style={{ border: 0 }}><Icone nom="users" /></span>{l.libelle}</Link>)}
    </nav>
  );
}
