'use client';

import Link from 'next/link';
import { useState } from 'react';
import { euros, sousTitreVin } from '@/lib/format';
import { COULEURS, type Vin } from '@/lib/types';
import { Etiquette } from './Etiquette';

/** Carte des vins par onglets : on ne voit que les vins de la couleur choisie, groupés par région. */
export function OngletsCarte({ restaurant, vins }: { restaurant: string; vins: Vin[] }) {
  // Quatre onglets principaux ; « Orange » et « Doux » n'apparaissent que si la carte en contient.
  const onglets = COULEURS.filter((c) => ['bulles', 'blanc', 'rose', 'rouge'].includes(c.id) || vins.some((v) => v.couleur === c.id));
  const [actif, setActif] = useState(onglets.find((o) => vins.some((v) => v.couleur === o.id))?.id ?? 'blanc');
  const liste = vins.filter((v) => v.couleur === actif);
  const sections = [...new Set(liste.map((v) => v.section ?? ''))];

  return (
    <>
      <div className="onglets" role="tablist" aria-label="Couleurs">
        {onglets.map((o) => {
          const n = vins.filter((v) => v.couleur === o.id).length;
          return (
            <button key={o.id} role="tab" type="button" className="onglet" aria-selected={actif === o.id} onClick={() => setActif(o.id)} style={n ? undefined : { color: '#B8B8B8' }}>
              {o.libelle}
              <small>{n} vin{n > 1 ? 's' : ''}</small>
            </button>
          );
        })}
      </div>
      <div className="panneau" role="tabpanel">
        {!liste.length && <p className="note-discrete" style={{ padding: '32px 0' }}>Pas de vin de cette couleur à la carte en ce moment.</p>}
        {sections.map((s) => (
          <div key={s || 'sans-section'}>
            {s && <div className="sous-titre">{s}</div>}
            {liste.filter((v) => (v.section ?? '') === s).map((v) => (
              <Link key={v.id} href={`/${restaurant}/vin/${v.id}`} className="ligne-vin">
                <Etiquette url={v.etiquette_url} nom={v.libelle} largeur={52} hauteur={52} />
                <div className="infos">
                  <span className="nom">{v.libelle}</span>
                  <span className="sous">{sousTitreVin(v)}</span>
                </div>
                {(v.prix ?? v.prix_verre) !== null && (
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
