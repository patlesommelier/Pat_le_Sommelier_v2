// Pat attablé avec sa bouteille, qui se balance doucement : animation des temps d'attente (lecture de la carte,
// préparation des accords, présentations…). Décorative : le texte d'attente à côté reste l'information.
export function PatAttente({ taille = 56 }: { taille?: number }) {
  const largeur = Math.round(taille * 1.27); // illustration en largeur (592 × 465)
  return (
    <span className="pat-attente" style={{ width: largeur, height: taille }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pat/pat-attable-rouge.svg" alt="" width={largeur} height={taille} />
    </span>
  );
}
