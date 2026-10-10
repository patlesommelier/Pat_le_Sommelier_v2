import Link from 'next/link';
import { appOuverte } from '@/lib/ouverture';
import { notFound } from 'next/navigation';
import { DemanderAPat } from '@/components/DemanderAPat';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { getPlat, getPropositions, getRestaurant } from '@/lib/donnees';
import { euros, lignePrix, sousTitreVin } from '@/lib/format';
import { tarifsDuRestaurant } from '@/lib/tarifs';
import { cleMemeVin } from '@/lib/contenances';

/** Mention discrète des vins ajoutés par les règles 7 et 8 (vin plus cher, vin moins cher). */
const MENTIONS: Partial<Record<string, string>> = {
  plus_cher: 'Pour une belle occasion',
  moins_cher: 'Plus accessible',
};

export default async function Propositions({
  params, searchParams,
}: { params: Promise<{ resto: string; plat: string }>; searchParams: Promise<{ tour?: string }> }) {
  const { resto, plat: platId } = await params;
  if (!(await appOuverte(resto))) return null; // fermé au public : le layout affiche la page d'attente
  const tour = Math.max(1, Math.min(10, Number((await searchParams).tour) || 1));
  const [restaurant, plat] = await Promise.all([getRestaurant(resto), getPlat(platId)]);
  if (!restaurant || !plat) notFound();
  const [{ propositions, encore }, tarifs] = await Promise.all([getPropositions(resto, platId, tour), tarifsDuRestaurant(resto)]);
  const service = propositions.find((p) => p.accord.service)?.accord.service;
  const ici = `/${resto}/plat/${plat.id}`;

  return (
    <>
      <Entete restaurant={restaurant} retour={`/${resto}`} />
      <main className="defile">
        <div className="contenu">
          <div className="titre-page">
            <h1>{tour > 1 ? 'Autres propositions' : 'Mes propositions'}</h1>
            <div className="filet" />
            <p>Pour : {plat.nom_court ?? plat.nom}</p>
          </div>
          {plat.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plat.photo_url} alt={plat.nom} className="photo-plat" />
          )}

          {propositions.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {propositions.map(({ accord, vin, motif }) => (
                <Link key={vin.id} href={`/${resto}/vin/${vin.id}?plat=${plat.id}`} className="carte-vin">
                  <Etiquette url={vin.etiquette_url} nom={vin.libelle} largeur={100} hauteur={100} />
                  <div className="infos">
                    {MENTIONS[motif] && <div className="mention">{MENTIONS[motif]}</div>}
                    <div className="nom">{vin.libelle}</div>
                    <div className="sous">{sousTitreVin(vin, true)}</div>
                    {accord.explication && <div className="pourquoi">{accord.explication}</div>}
                    <div className="prix" style={{ fontSize: 16 }}>
                      {tarifs.get(cleMemeVin(vin))?.length ? <>
                        {lignePrix(tarifs.get(cleMemeVin(vin))!.slice(0, 1))}
                        {tarifs.get(cleMemeVin(vin))!.length > 1 && <span style={{ fontWeight: 400, color: 'var(--discret)', fontSize: 13 }}> · {lignePrix(tarifs.get(cleMemeVin(vin))!.slice(1))}</span>}
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
              <p className="note-discrete">Les autres vins de la carte s’accordent moins bien avec ce plat. Je vous conseille de revenir à mes premières propositions.</p>
              <Link href={ici} className="bouton-plein">Revoir mes propositions</Link>
            </div>
          ) : (
            <div className="etat-vide">
              <p className="note-discrete">Aucun vin de la carte ne s’accorde vraiment bien avec ce plat.</p>
              <DemanderAPat question={`Quel vin de la carte me conseillez-vous avec « ${plat.nom} » ?`}>Demander conseil à Pat</DemanderAPat>
            </div>
          )}

          {service && <p className="note-discrete">À servir à {service}</p>}

          {propositions.length > 0 && (
            <div className="autres">
              {tour > 1 && <Link href={tour === 2 ? ici : `${ici}?tour=${tour - 1}`} className="lien-discret">← Propositions précédentes</Link>}
              {encore && <Link href={`${ici}?tour=${tour + 1}`} className="lien-discret">Voir d’autres vins →</Link>}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
