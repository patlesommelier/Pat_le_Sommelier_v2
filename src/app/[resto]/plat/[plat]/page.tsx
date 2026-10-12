import Link from 'next/link';
import { appOuverte } from '@/lib/ouverture';
import { notFound } from 'next/navigation';
import { DemanderAPat } from '@/components/DemanderAPat';
import { Entete, menuDe } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { getPlat, getPlats, getPropositions, getRestaurant } from '@/lib/donnees';
import { euros, lignePrix } from '@/lib/format';
import { tarifsDuRestaurant } from '@/lib/tarifs';
import { titreCarte } from '@/lib/admin/intitule';

/** Mention discrète des vins ajoutés par les règles 7 et 8 (vin plus cher, vin moins cher). */
const MENTIONS: Partial<Record<string, string>> = {
  plus_cher: 'Pour une belle occasion',
  moins_cher: 'Plus accessible',
};

export default async function Propositions({
  params, searchParams,
}: { params: Promise<{ resto: string; plat: string }>; searchParams: Promise<{ tour?: string; et?: string }> }) {
  const { resto, plat: platId } = await params;
  if (!(await appOuverte(resto))) return null; // fermé au public : le layout affiche la page d'attente
  const sp = await searchParams;
  const tour = Math.max(1, Math.min(10, Number(sp.tour) || 1));
  const [restaurant, plat, carte] = await Promise.all([getRestaurant(resto), getPlat(platId), getPlats(resto)]);
  if (!restaurant || !plat) notFound();
  // Autres plats choisis en même temps dans le menu (?et=id,id) : seulement ceux de ce restaurant.
  const autres = (sp.et ?? '').split(',').map((x) => x.trim()).filter((x) => x && x !== plat.id && carte.some((p) => p.id === x)).slice(0, 8);
  const tous = [plat.id, ...new Set(autres)];
  const nomPlat = (id: string) => { const p = id === plat.id ? plat : carte.find((x) => x.id === id); return p ? p.nom_court ?? p.nom : ''; };
  const [{ propositions, encore }, tarifs] = await Promise.all([getPropositions(resto, tous, tour), tarifsDuRestaurant(resto)]);
  const service = tous.length === 1 ? propositions.find((p) => p.accord.service)?.accord.service : undefined;
  const avecEt = (q: string) => { const u = new URLSearchParams(q); if (tous.length > 1) u.set('et', tous.slice(1).join(',')); const s = u.toString(); return s ? `?${s}` : ''; };
  const ici = `/${resto}/plat/${plat.id}`;
  const lienTour = (t: number) => `${ici}${avecEt(t > 1 ? `tour=${t}` : '')}`;
  const pour = tous.map(nomPlat);
  const libellePour = pour.length > 1 ? `${pour.slice(0, -1).join(', ')} et ${pour[pour.length - 1]}` : pour[0];

  return (
    <>
      <Entete restaurant={restaurant} retour={menuDe(restaurant)} />
      <main className="defile">
        <div className="contenu">
          <div className="titre-page">
            <h1>{tour > 1 ? 'Autres propositions' : 'Mes propositions'}</h1>
            <div className="filet" />
            <p>Pour : {libellePour}</p>
          </div>
          {tous.length === 1 && plat.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plat.photo_url} alt={plat.nom} className="photo-plat" />
          )}

          {propositions.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {propositions.map(({ accord, vin, motif, parPlat, ensemble }) => (
                <Link key={vin.id} href={`/${resto}/vin/${vin.id}?plat=${plat.id}`} className="carte-vin">
                  <Etiquette url={vin.etiquette_url} nom={vin.libelle} largeur={100} hauteur={100} />
                  <div className="infos">
                    {MENTIONS[motif] && <div className="mention">{MENTIONS[motif]}</div>}
                    {(() => {
                      // Comme dans la carte : nom du vin et millésime, puis producteur, appellation et cépages.
                      const t = titreCarte({ ...vin, producteur: vin.producteur_nom ?? vin.producteur_texte });
                      return <><div className="nom">{t.titre}</div>{t.sousTitre && <div className="sous">{t.sousTitre}</div>}</>;
                    })()}
                    {ensemble ? <div className="pourquoi">{ensemble}</div>
                      : parPlat
                      ? parPlat.filter((x) => x.explication).map((x) => <div key={x.plat_id} className="pourquoi"><b>{nomPlat(x.plat_id)} :</b> {x.explication}</div>)
                      : accord.explication && <div className="pourquoi">{accord.explication}</div>}
                    <div className="prix" style={{ fontSize: 16 }}>
                      {tarifs.get(vin.id)?.length ? <>
                        {lignePrix(tarifs.get(vin.id)!.slice(0, 1))}
                        {tarifs.get(vin.id)!.length > 1 && <span style={{ fontWeight: 400, color: 'var(--discret)', fontSize: 13 }}> · {lignePrix(tarifs.get(vin.id)!.slice(1))}</span>}
                      </> : <>
                      {vin.prix ? euros(vin.prix) : vin.prix_verre ? `${euros(vin.prix_verre)} le verre` : ''}
                      {vin.prix && vin.prix_verre ? <span style={{ fontWeight: 400, color: 'var(--discret)', fontSize: 13 }}> · verre {euros(vin.prix_verre)}</span> : null}
                      </>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : tour > 1 ? (
            <div className="etat-vide">
              <p className="note-discrete">Les autres vins de la carte s’accordent moins bien avec {tous.length > 1 ? 'ces plats' : 'ce plat'}. Je vous conseille de revenir à mes premières propositions.</p>
              <Link href={lienTour(1)} className="bouton-plein">Revoir mes propositions</Link>
            </div>
          ) : (
            <div className="etat-vide">
              <p className="note-discrete">Aucun vin de la carte ne s’accorde vraiment bien avec {tous.length > 1 ? 'tous ces plats à la fois' : 'ce plat'}.</p>
              <DemanderAPat question={`Quel vin de la carte me conseillez-vous avec « ${pour.join(' », « ')} » ?`}>Demander conseil à Pat</DemanderAPat>
            </div>
          )}

          {service && <p className="note-discrete">À servir à {service}</p>}

          {propositions.length > 0 && (
            <div className="autres">
              {tour > 1 && <Link href={lienTour(tour - 1)} className="lien-discret">← Propositions précédentes</Link>}
              {encore && <Link href={lienTour(tour + 1)} className="lien-discret">Voir d’autres vins →</Link>}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
