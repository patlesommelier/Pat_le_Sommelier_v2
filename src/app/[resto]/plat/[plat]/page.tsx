import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DemanderAPat } from '@/components/DemanderAPat';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { getPlat, getPropositions, getRestaurant } from '@/lib/donnees';
import { euros, sousTitreVin } from '@/lib/format';

export default async function Propositions({ params }: { params: Promise<{ resto: string; plat: string }> }) {
  const { resto, plat: platId } = await params;
  const [restaurant, plat] = await Promise.all([getRestaurant(resto), getPlat(platId)]);
  if (!restaurant || !plat) notFound();
  const propositions = await getPropositions(platId);
  const service = propositions.find((p) => p.accord.service)?.accord.service;

  return (
    <>
      <Entete restaurant={restaurant} retour={`/${resto}`} />
      <main className="defile">
        <div className="contenu">
          <div className="titre-page">
            <h1>Mes propositions</h1>
            <div className="filet" />
            <p>Pour : {plat.nom_court ?? plat.nom}</p>
          </div>

          {propositions.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {propositions.map(({ accord, vin }) => (
                <Link key={vin.id} href={`/${resto}/vin/${vin.id}?plat=${plat.id}`} className="carte-vin">
                  <Etiquette url={vin.etiquette_url} nom={vin.libelle} largeur={100} hauteur={100} />
                  <div className="infos">
                    <div className="nom">{vin.libelle}</div>
                    <div className="sous">{sousTitreVin(vin, true)}</div>
                    {accord.explication && <div className="pourquoi">{accord.explication}</div>}
                    <div className="prix" style={{ fontSize: 16 }}>
                      {euros(vin.prix)}
                      {vin.prix_verre ? <span style={{ fontWeight: 400, color: 'var(--discret)', fontSize: 13 }}> · verre {euros(vin.prix_verre)}</span> : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="etat-vide">
              <p className="note-discrete">Le sommelier n’a pas encore validé d’accord pour ce plat.</p>
              <DemanderAPat question={`Quel vin de la carte me conseillez-vous avec « ${plat.nom} » ?`}>Demander à Pat</DemanderAPat>
            </div>
          )}

          {service && <p className="note-discrete">À servir à {service}</p>}
        </div>
      </main>
    </>
  );
}
