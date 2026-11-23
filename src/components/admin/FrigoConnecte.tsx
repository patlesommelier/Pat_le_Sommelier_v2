// Un frigo connecté (WineMS) : son état, sa température, ses bouteilles par vin (nom, photo et prix de la base Quid Vinum).
// Montré dans « Ma cave » et dans « Frigos connectés ».
import { Icone } from '@/components/admin/Icone';
import { euros } from '@/lib/bon-commande';
import type { FrigoRestaurant } from '@/lib/frigos/winems';

/** État affiché d'un frigo : en maintenance ou au dépôt (WineMS) d'abord, sinon son état de connexion. */
export const etatFrigo = (f: Pick<FrigoRestaurant, 'cycle' | 'statut'>): [string, string] => (f.cycle === 2 ? ['En maintenance', '#E3A21A'] : f.cycle === 1 ? ['Au dépôt', '#9C9491']
  : f.statut === 0 ? ['Connecté', '#2E9E5B'] : f.statut === 1 ? ['Déconnecté', '#B3261E'] : f.statut === 2 ? ['En erreur', '#B3261E'] : ['État inconnu', '#9C9491']);

export function FrigoConnecte({ f }: { f: FrigoRestaurant }) {
  const total = f.vins.reduce((n, v) => n + v.bouteilles, 0);
  const etat = etatFrigo(f);
  return (
    <section className="carte-bo frigo-connecte pile" style={{ gap: 14 }} aria-labelledby={`frigo-${f.id}`}>
      <div className="ligne-actions" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="pile" style={{ gap: 4 }}>
          <h2 id={`frigo-${f.id}`} style={{ margin: 0 }}>Frigo connecté · {f.nom}</h2>
          <span className="petit discret">En consignation · LVQNEP{f.emplacement ? ` · ${f.emplacement}` : ''}</span>
        </div>
        <div className="ligne-actions" style={{ gap: 18 }}>
          <span className="frigo-info"><span className="rond-mode" style={{ background: etat[1] }} aria-hidden="true" />{etat[0]}</span>
          {f.temperature != null && <span className="frigo-info">{f.temperature.toLocaleString('fr-BE', { maximumFractionDigits: 1 })} °C</span>}
          <span className="frigo-info"><b>{total}</b>{f.capacite ? ` / ${f.capacite}` : ''} bouteille{total > 1 ? 's' : ''}</span>
        </div>
      </div>
      <p className="petit discret" style={{ margin: 0 }}>Géré automatiquement : chaque bouteille est reconnue par son tag dès qu’elle entre ou sort du frigo. Rien à compter à l’inventaire ; une bouteille sortie est facturée par LVQNEP en fin de mois.</p>
      {f.vins.length ? (
        <div className="tableau"><table>
          <thead><tr><th>Vin</th><th>Millésime</th><th style={{ textAlign: 'right' }}>Bouteilles</th><th style={{ textAlign: 'right' }}>Achat HTVA</th><th style={{ textAlign: 'right' }}>Prix conseillé</th></tr></thead>
          <tbody>
            {f.vins.map((v, i) => (
              <tr key={i}>
                <td>
                  <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* Vignette de l'étiquette (photo servie par WineMS) ; sans photo, la bouteille dessinée. */}
                    {v.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={v.image_url} alt="" loading="lazy" className="vignette-frigo" />
                      : <span className="vignette-frigo vide" aria-hidden="true"><Icone nom="bottle" taille={18} /></span>}
                    <span><b>{v.nom}</b><br /><span className="petit discret">{[v.producteur, v.appellation].filter(Boolean).join(' · ')}</span></span>
                  </span>
                </td>
                <td>{v.millesime ?? '—'}</td>
                <td style={{ textAlign: 'right' }}><b>{v.bouteilles}</b></td>
                <td style={{ textAlign: 'right' }}>{v.prix_achat != null ? euros(v.prix_achat) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{v.prix_conseille != null ? euros(v.prix_conseille) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : <p className="petit" style={{ margin: 0 }}>Le frigo est vide pour l’instant.</p>}
    </section>
  );
}
