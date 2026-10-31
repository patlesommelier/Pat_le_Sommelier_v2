'use client';
// Catalogue d'un distributeur Quid Vinum dans « Nouvelle commande » : les vins au prix proposé, groupés par section,
// avec une recherche qui masque les lignes (les quantités déjà saisies restent dans le formulaire).
import { useState } from 'react';

export interface LigneCatalogue {
  id: string; section: string | null; producteur: string | null; libelle: string; millesime: string | null; contenance: string | null;
  prix: number | null; epuise: boolean; maximum: number | null; surCarte: { stock: number; enCommande: number; bas: boolean } | null;
}

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const euros = (n: number) => n.toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' });

export function CatalogueCommande({ lignes, choisi }: { lignes: LigneCatalogue[]; choisi?: string }) {
  const [q, setQ] = useState('');
  const [carteSeulement, setCarteSeulement] = useState(false);
  const mots = sansAccents(q).split(/\s+/).filter(Boolean);
  const visible = (l: LigneCatalogue) => (!carteSeulement || l.surCarte) &&
    mots.every((m) => sansAccents(`${l.producteur ?? ''} ${l.libelle} ${l.millesime ?? ''} ${l.section ?? ''}`).includes(m));
  const sections = [...new Set(lignes.map((l) => l.section ?? ''))];
  const nbVisibles = lignes.filter(visible).length;
  return (
    <div className="pile" style={{ gap: 10 }}>
      <div className="catalogue-filtre">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un vin, un domaine, une région…" aria-label="Chercher dans le catalogue" />
        <label className="petit" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={carteSeulement} onChange={(e) => setCarteSeulement(e.target.checked)} /> Seulement les vins de ma carte</label>
        <span className="discret petit">{nbVisibles} vin{nbVisibles > 1 ? 's' : ''}</span>
      </div>
      <div className="tableau">
        <table style={{ minWidth: 640 }}>
          <thead><tr><th>Vin</th><th className="droite">Sur ma carte</th><th className="droite">Prix HTVA</th><th className="droite">À commander</th></tr></thead>
          <tbody>
            {sections.map((s) => {
              const deLaSection = lignes.filter((l) => (l.section ?? '') === s);
              const montrer = deLaSection.some(visible);
              return [
                s && montrer ? <tr key={`s-${s}`} className="catalogue-section"><td colSpan={4}>{s}</td></tr> : null,
                ...deLaSection.map((l) => (
                  <tr key={l.id} hidden={!visible(l)} className={choisi === l.id ? 'choisi' : undefined}>
                    <td><div className="nom">{l.libelle}{l.millesime ? ` ${l.millesime}` : ''}{l.contenance && <span className="discret"> · {l.contenance}</span>}</div>
                      <div className="petit">{l.producteur ?? ''}{l.epuise && <b style={{ color: '#FF0D05' }}> · Épuisé</b>}{l.maximum != null && !l.epuise && <> · {l.maximum} au plus</>}</div></td>
                    <td className="droite" style={{ whiteSpace: 'nowrap' }}>{l.surCarte ? <>{l.surCarte.bas && <span className="alerte-stock" role="img" aria-label="Stock bas" title="Stock bas">!</span>} {l.surCarte.stock} en stock{l.surCarte.enCommande ? ` · ${l.surCarte.enCommande} en commande` : ''}</> : <span className="discret">—</span>}</td>
                    <td className="droite" style={{ whiteSpace: 'nowrap' }}>{l.prix != null ? euros(l.prix) : '—'}</td>
                    <td className="droite"><input type="number" name={`cat_${l.id}`} min={0} max={l.maximum ?? 10000} disabled={l.epuise || l.prix == null} placeholder="0" className="champ-commande" aria-label={`Bouteilles à commander : ${l.libelle}`} /></td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
