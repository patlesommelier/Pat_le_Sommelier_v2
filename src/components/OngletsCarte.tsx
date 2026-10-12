'use client';

import Link from 'next/link';
import { useState } from 'react';
import { euros, lignePrix, sousTitreVin } from '@/lib/format';
import { COULEURS, type VinOnglet } from '@/lib/types';
import { Etiquette } from './Etiquette';

/** Catégories en plus des couleurs, choisies par le restaurant : un vin y figure aussi dans sa couleur. */
const EXTRAS: { id: string; libelle: string; garde: (v: VinOnglet) => boolean }[] = [
  { id: 'coups_de_coeur', libelle: 'Coups de cœur', garde: (v) => Boolean(v.coup_de_coeur) },
  { id: 'nature', libelle: 'Nature', garde: (v) => Boolean(v.nature) },
  { id: 'bio', libelle: 'Bio', garde: (v) => Boolean(v.bio) },
];

/** Carte des vins par onglets : on ne voit que les vins de la couleur choisie, groupés par région. */
export function OngletsCarte({ restaurant, vins, couleur, categories = [] }: { restaurant: string; vins: VinOnglet[]; couleur?: string; categories?: string[] }) {
  // Quatre onglets principaux ; « Orange » et « Doux » n'apparaissent que si la carte en contient.
  const couleurs = COULEURS.filter((c) => ['bulles', 'blanc', 'rose', 'rouge'].includes(c.id) || vins.some((v) => v.couleur === c.id));
  // Puis les catégories choisies par le restaurant, si elles ont des vins.
  const extras = EXTRAS.filter((e) => categories.includes(e.id) && vins.some(e.garde));
  const onglets: { id: string; libelle: string }[] = [...couleurs, ...extras];
  const dans = (id: string) => { const e = extras.find((x) => x.id === id); return (v: VinOnglet) => (e ? e.garde(v) : v.couleur === id); };
  // Couleur ouverte : celle de l'adresse (?c=, retour depuis la fiche d'un vin), sinon la première qui a des vins.
  const [actif, setActif] = useState<string>(onglets.find((o) => o.id === couleur)?.id ?? couleurs.find((o) => vins.some((v) => v.couleur === o.id))?.id ?? 'blanc');
  const choisir = (id: typeof actif, el?: HTMLElement) => {
    setActif(id);
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    // Gardée dans l'adresse : le bouton « retour » du téléphone ramène sur la même couleur.
    window.history.replaceState(null, '', `?c=${id}`);
  };
  const extra = extras.some((e) => e.id === actif);
  const liste = vins.filter(dans(actif));
  // Catégorie en plus : les vins groupés par couleur ; sinon par rubrique de la carte.
  const rubrique = (v: VinOnglet) => (extra ? COULEURS.find((c) => c.id === v.couleur)?.libelle ?? '' : v.section ?? '');
  const sections = [...new Set(liste.map(rubrique))];

  return (
    <>
      <div className="onglets" role="tablist" aria-label="Couleurs">
        {onglets.map((o) => {
          const n = vins.filter(dans(o.id)).length;
          return (
            <button key={o.id} role="tab" type="button" className="onglet" aria-selected={actif === o.id} onClick={(e) => choisir(o.id, e.currentTarget)} style={n ? undefined : { color: '#B8B8B8' }}>
              {o.libelle}
              <small>{n} vin{n > 1 ? 's' : ''}</small>
            </button>
          );
        })}
      </div>
      <div className="panneau" role="tabpanel">
        {!liste.length && <p className="note-discrete" style={{ padding: '32px 0' }}>Pas de vin {extra ? 'dans cette catégorie' : 'de cette couleur'} à la carte en ce moment.</p>}
        {sections.map((s) => (
          <div key={s || 'sans-section'}>
            {s && <div className="sous-titre">{s}</div>}
            {liste.filter((v) => rubrique(v) === s).map((v) => (
              <Link key={v.id} href={`/${restaurant}/vin/${v.id}`} className="ligne-vin">
                <Etiquette url={v.etiquette_url} nom={v.libelle} largeur={52} hauteur={52} />
                <div className="infos">
                  <span className="nom">{v.titre ?? v.libelle}{v.coup_de_coeur && <Coeur />}</span>
                  <span className="sous">{v.titre !== undefined ? v.sousTitre : sousTitreVin({ ...v, format: v.tarifs?.length ? undefined : v.format })}</span>
                </div>
                {v.tarifs?.length ? (
                  <span className="prix">
                    {lignePrix(v.tarifs.slice(0, 1))}
                    {v.tarifs.slice(1).map((t) => <small key={t.code}>{lignePrix([t])}</small>)}
                  </span>
                ) : (v.prix ?? v.prix_verre) !== null && (
                  <span className="prix">
                    {euros(v.prix ?? v.prix_verre)}
                    {v.prix_verre && v.prix ? <small>verre {euros(v.prix_verre)}</small> : null}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** Petit cœur des coups de cœur de la maison. */
export function Coeur() {
  return <span className="coeur" role="img" aria-label="Coup de cœur" title="Coup de cœur de la maison">♥</span>;
}
