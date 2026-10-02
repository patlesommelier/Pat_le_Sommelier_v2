import { Bouteille } from './Icones';

/** Étiquette du vin, ou un cadre neutre « Étiquette à venir » quand on ne l'a pas encore. */
export function Etiquette({ url, nom, largeur, hauteur }: { url: string | null; nom: string; largeur: number; hauteur: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="etiquette" src={url} alt={`Étiquette ${nom}`} width={largeur} height={hauteur} style={{ width: largeur, height: hauteur }} loading="lazy" />;
  }
  return (
    <div className="etiquette-vide" role="img" aria-label="Étiquette à venir" style={{ width: largeur, height: hauteur }}>
      <Bouteille taille={largeur > 200 ? 40 : largeur > 60 ? 30 : 22} />
      {largeur > 200 && <span>Étiquette à venir</span>}
    </div>
  );
}
