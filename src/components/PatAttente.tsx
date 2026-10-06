// Pat qui avance en se dandinant avec sa bouteille : animation des temps d'attente (lecture de la carte,
// préparation des accords, présentations…). Décorative : le texte d'attente à côté reste l'information.
export function PatAttente({ taille = 56 }: { taille?: number }) {
  return (
    <span className="pat-attente" style={{ width: taille, height: Math.round(taille * 1.14) }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pat/pat.png" alt="" width={taille} height={Math.round(taille * 1.1)} />
    </span>
  );
}
