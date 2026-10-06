'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icone } from './Icone';

export type EtatEtape = 'fait' | 'encours' | 'afaire';
/** Étape du menu de gauche, rangée sous son groupe ; un outil (icône) n'est pas une étape à cocher. */
export interface Etape { href: string; libelle: string; etat: EtatEtape; groupe?: string; icone?: string }

/** Liens du menu de gauche ; l'étape ouverte est mise en évidence. */
export function NavLiens({ accueil, etapes, admin }: { accueil: string; etapes: Etape[]; admin?: { href: string; libelle: string }[] }) {
  const chemin = usePathname();
  const courant = (href: string) => (href === accueil ? chemin === href : chemin.startsWith(href)) ? 'page' : undefined;
  return (
    <nav aria-label="Back-office" className="bo-liens">
      <Link href={accueil} className="bo-lien" aria-current={courant(accueil)}><span className="bo-num" style={{ border: 0 }}><Icone nom="home" /></span>Tableau de bord</Link>
      {etapes.map((e, i) => (
        <Fragment key={e.href}>
          {e.groupe && e.groupe !== etapes[i - 1]?.groupe && <div className="section">{e.groupe}</div>}
          <Link href={e.href} className="bo-lien" aria-current={courant(e.href)}>
            {e.icone ? <span className="bo-num" style={{ border: 0 }}><Icone nom={e.icone} /></span> : (
              <span className={`bo-num ${e.etat}`} aria-label={e.etat === 'fait' ? 'Terminé' : undefined}>
                {e.etat === 'fait' ? <Icone nom="check" taille={14} epaisseur={2.4} /> : i + 1}
              </span>
            )}
            {e.libelle}
          </Link>
        </Fragment>
      ))}
      {admin?.length ? <div className="section">Pat</div> : null}
      {admin?.map((l) => <Link key={l.href} href={l.href} className="bo-lien" aria-current={courant(l.href)}><span className="bo-num" style={{ border: 0 }}><Icone nom="users" /></span>{l.libelle}</Link>)}
    </nav>
  );
}
