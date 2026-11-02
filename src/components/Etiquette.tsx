/**
 * Étiquette du vin ; sans étiquette, le logo de son distributeur (sur fond blanc, entier) ; sinon un cadre comme une étiquette
 * avec le nom du vin.
 */
export function Etiquette({ url, logo, nom, largeur, hauteur }: { url: string | null; logo?: string | null; nom: string; largeur: number; hauteur: number }) {
  // Grand format (fiche vin) : centré et jamais plus large que l'écran.
  const taille = largeur > 200 ? { width: largeur, height: hauteur, maxWidth: '100%', alignSelf: 'center' as const } : { width: largeur, height: hauteur };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="etiquette" src={url} alt={`Étiquette ${nom}`} width={largeur} height={hauteur} style={taille} loading="lazy" />;
  }
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="etiquette etiquette-logo" src={logo} alt={nom} width={largeur} height={hauteur} style={{ ...taille, padding: largeur < 70 ? 4 : 10 }} loading="lazy" />;
  }
  // Taille du nom selon la place : grand sur la fiche du vin, petit dans les listes.
  const police = largeur > 200 ? 20 : largeur >= 90 ? 12 : largeur >= 70 ? 10.5 : 6.8;
  return (
    <div className="etiquette-vide" role="img" aria-label={`${nom} (étiquette à venir)`} style={{ ...taille, padding: largeur < 70 ? 2 : 4 }}>
      <span className="etiquette-cadre" style={{ padding: largeur < 70 ? 1 : 3 }}><span className="etiquette-nom" style={{ fontSize: police }}>{nom}</span></span>
    </div>
  );
}
