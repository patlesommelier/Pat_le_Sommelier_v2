// Gestion de cave — Inventaire : le seul endroit où le restaurant change son stock (bouteilles comptées), loin du prix de vente.
// « Valider l'inventaire » enregistre tous les stocks et la date ; « Rien n'a changé » valide sans rien changer.
import Link from 'next/link';
import { enregistrerInventaire } from '../../stocks-actions';
import { ChampStock, RechercheInventaire } from '@/components/admin/Inventaire';
import { Entete } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { getRestaurantBO, getVinsBO } from '@/lib/admin/donnees';
import { stockBas } from '@/lib/admin/stocks';
import { nomPourListe, regrouperVins } from '../carte/etats';
import { VignetteVin } from '@/components/admin/VignetteVin';
import { ilYA } from '@/lib/admin/inventaire';

const COULEURS = [['bulles', 'Bulles'], ['blanc', 'Blancs'], ['rose', 'Rosés'], ['orange', 'Orange'], ['rouge', 'Rouges'], ['doux', 'Doux'], ['sans_alcool', 'Sans alcool']] as const;
const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function Inventaire({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const [vins, r] = await Promise.all([getVinsBO(resto), getRestaurantBO(resto)]);
  const limite = r?.stock_limite_basse ?? 2;
  const groupes = regrouperVins(vins).map((g) => ({ ...g, disponible: g.tous.some((x) => x.disponible) }));
  // Les vins à la carte d'abord (ce qu'on compte chaque semaine), puis ceux qui n'y sont pas.
  const parCouleur = COULEURS.map(([k, l]) => ({ titre: l, groupes: groupes.filter((g) => g.principal.couleur === k).sort((a, b) => Number(b.disponible) - Number(a.disponible)) }))
    .filter((c) => c.groupes.length);
  const dernier = r?.inventaire_le ?? null;
  const action = enregistrerInventaire.bind(null, resto);

  return (
    <>
      <Entete titre="Inventaire" texte="Comptez vos bouteilles et indiquez le stock de chaque vin, puis validez l’inventaire. C’est le seul endroit où le stock se change ; il augmente aussi tout seul quand vous recevez une commande.">
        <Link href={`/admin/${resto}/stocks`} className="btn fantome">← Les vins</Link>
      </Entete>
      <p className="petit" style={{ margin: 0 }}>{dernier ? <>Dernier inventaire : <b>{ilYA(dernier)}</b>.</> : <b>Aucun inventaire pour l’instant.</b>}</p>
      <form action={action} className="pile" style={{ gap: 14 }}>
        <div className="ligne-actions" style={{ alignItems: 'center' }}>
          <RechercheInventaire />
          <button className="btn">Valider l’inventaire</button>
          <button className="btn sec" name="rien" value="1" title="Valide l’inventaire sans changer aucun stock">Rien n’a changé</button>
        </div>
        {!groupes.length && <p className="discret">Aucun vin dans votre cave pour l’instant.</p>}
        {parCouleur.length > 0 && (
          <div className="tableau">
            <table className="table-stocks table-inventaire">
              <thead><tr><th>Vin</th><th className="droite">En stock (bouteilles)</th></tr></thead>
              {parCouleur.map((c) => (
                <tbody key={c.titre}>
                  <tr className="rubrique"><td colSpan={2}><b className="rubrique-carte">{c.titre}</b></td></tr>
                  {c.groupes.map(({ principal: v, disponible }) => {
                    const nom = nomPourListe(v);
                    return (
                      <tr key={v.id} data-recherche={sansAccents(`${nom.join(' ')} ${v.libelle} ${v.millesime ?? ''}`)} className={disponible ? undefined : 'indisponible'}>
                        <td><div className="vin-cell"><VignetteVin url={v.etiquette_url} logo={v.logo_distributeur} taille={36} />
                          <div><div className="nom">{nom[0]}</div>{nom.length > 1 && <div className="petit">{nom.slice(1).join(' · ')}</div>}
                            {!disponible && <div className="petit discret">Pas sur votre carte</div>}
                            {disponible && stockBas(v.stock, limite) && <div className="petit" style={{ color: 'var(--rouge)' }}>Stock bas</div>}</div></div></td>
                        <td className="droite"><ChampStock id={v.id} stock={v.stock} libelle={v.libelle} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        {groupes.length > 0 && <span><button className="btn">Valider l’inventaire</button></span>}
      </form>
    </>
  );
}
