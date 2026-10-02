import { Bouteille } from './Icones';

/** Étiquette du vin, ou un cadre neutre « Étiquette à venir » quand on ne l'a pas encore. */
export function Etiquette({ url, nom, largeur, hauteur }: { url: string | null; nom: string; largeur: number; hauteur: number }) {
  // Grand format (fiche vin) : centré et jamais plus large que l'écran.
  const taille = largeur > 200 ? { width: largeur, height: hauteur, maxWidth: '100%', alignSelf: 'center' as const } : { width: largeur, height: hauteur };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="etiquette" src={url} alt={`Étiquette ${nom}`} width={largeur} height={hauteur} style={taille} loading="lazy" />;
  }
  return (
    <div className="etiquette-vide" role="img" aria-label="Étiquette à venir" style={taille}>
      <Bouteille taille={largeur > 200 ? 40 : largeur > 60 ? 30 : 22} />
      {largeur > 200 && <span>Étiquette à venir</span>}
    </div>
  );
}
