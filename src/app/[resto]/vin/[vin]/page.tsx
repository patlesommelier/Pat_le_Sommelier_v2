import { notFound } from 'next/navigation';
import { appOuverte } from '@/lib/ouverture';
import { Entete } from '@/components/Entete';
import { Etiquette } from '@/components/Etiquette';
import { getAccord, getPlat, getRestaurant, getVin } from '@/lib/donnees';
import { avecAppreciation } from '@/lib/appreciation';
import { euros } from '@/lib/format';
import { COULEURS } from '@/lib/types';

const JAUGES = [
  ['douceur', 'Douceur'],
  ['acidite', 'Acidité'],
  ['corps', 'Corps'],
  ['intensite', 'Intensité aromatique'],
  ['tanins', 'Tanins'],
  ['boise', 'Boisé'],
] as const;

export default async function FicheVin({ params, searchParams }: { params: Promise<{ resto: string; vin: string }>; searchParams: Promise<{ plat?: string }> }) {
  const { resto, vin: vinId } = await params;
  if (!(await appOuverte(resto))) return null; // fermé au public : le layout affiche la page d'attente
  const { plat: platId } = await searchParams;
  const [restaurant, vin, plat] = await Promise.all([getRestaurant(resto), getVin(resto, vinId), platId ? getPlat(platId) : null]);
  if (!restaurant || !vin) notFound();
  const accord = plat ? await getAccord(plat.id, vin.id) : null;
  const p = vin.profil_degustation;
  const producteur = (vin.producteur_nom ?? vin.producteur_texte ?? '').replace(/\s*\(.*\)/, '');
  const couleur = COULEURS.find((c) => c.id === vin.couleur)?.libelle.replace(/s$/, '');

  return (
    <>
      <Entete restaurant={restaurant} retour={plat ? `/${resto}/plat/${plat.id}` : `/${resto}/carte`} />
      <main className="defile">
        <div className="contenu">
          <Etiquette url={vin.etiquette_url} nom={vin.libelle} largeur={350} hauteur={210} />

          <div className="fiche-entete">
            <div className="surtitre">{[(vin.appellation_nom ?? vin.vin_texte?.split(' – ')[0])?.replace(/ AOC$/, ''), vin.millesime !== 'NM' ? vin.millesime : null].filter(Boolean).join(' · ') || couleur}</div>
            <h1>{vin.libelle}</h1>
            <div className="filet" />
            {producteur && !/^non /i.test(producteur) && <div className="lieu">{producteur}</div>}
          </div>

          <div className="pastilles">
            {couleur && <span className="pastille">{couleur}</span>}
            {vin.cepages?.split(/,\s*/).slice(0, 2).map((c) => <span key={c} className="pastille">{c.replace(/\s*\(.*\)/, '')}</span>)}
            {p?.stade && <span className="pastille">{p.stade.charAt(0).toUpperCase() + p.stade.slice(1)}</span>}
            {vin.coup_de_coeur && <span className="pastille">Coup de cœur</span>}
          </div>

          {(vin.presentation ?? vin.descriptif) && <p className="texte">{vin.presentation ?? vin.descriptif}</p>}

          {plat && accord && (
            <div className="encadre">
              <span className="titre">Avec : {plat.nom_court ?? plat.nom}</span>
              <div className="filet court" />
              <p>{avecAppreciation(accord.explication_longue ?? accord.explication, accord.note, { cle: accord.plat_id, ecritParLeRestaurant: Boolean(accord.commentaire_sommelier) })}</p>
            </div>
          )}

          <div className="ligne-prix">
            <div className="gauche">
              <span>{vin.format === '37,5 cl' ? 'Demi-bouteille' : vin.format === 'au verre' ? 'Au verre' : 'Bouteille'}</span>
              {vin.prix_verre && vin.format !== 'au verre' ? <span>Au verre : {euros(vin.prix_verre)}</span> : accord?.service ? <span>Servir à {accord.service}</span> : null}
            </div>
            <span className="prix">{euros(vin.prix ?? vin.prix_verre)}</span>
          </div>

          {p && (
            <div className="profil">
              <div className="titre-section">
                <span>Profil de dégustation</span>
                <div className="filet court" />
              </div>
              {JAUGES.map(([cle, libelle]) => {
                const v = p[cle];
                if (v === null || v === undefined) return null;
                return (
                  <div key={cle} className="jauge">
                    <span className="libelle">{libelle}</span>
                    <div className="barres" aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < v ? 'pleine' : ''} />)}
                    </div>
                    <span className="valeur">{v}/5</span>
                  </div>
                );
              })}
              {p.aromes?.length > 0 && (
                <div className="pastilles" style={{ marginTop: 4 }}>
                  {p.aromes.map((a) => <span key={a} className="pastille">{a.replace(/\s*\(.*\)/, '').replace(/^./, (c) => c.toUpperCase())}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
