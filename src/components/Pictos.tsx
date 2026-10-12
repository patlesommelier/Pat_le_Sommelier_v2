// Petits pictogrammes après le nom d'un vin : coup de cœur (♥ rouge), bio (feuille verte), nature (grappe verte).
// Dessins simples (pas d'émojis : ils changent d'un téléphone à l'autre) ; le mot apparaît au survol.
const VERT = '#3E8E41';

export function Feuille() {
  return (
    <svg className="picto" viewBox="0 0 16 16" width="0.95em" height="0.95em" role="img" aria-label="Bio">
      <title>Bio</title>
      <path d="M13.8 2.2C8.6 1.9 3.4 3.6 2.6 8.6c-.3 1.9.2 3.6 1 4.8C5.2 9.8 8 7.6 11 6.4 8.4 8 6 10.4 4.6 14c1.2.4 2.8.4 4.4-.3 4.6-2 5.3-7.2 4.8-11.5z" fill={VERT} />
    </svg>
  );
}

export function Grappe() {
  return (
    <svg className="picto" viewBox="0 0 16 16" width="0.95em" height="0.95em" role="img" aria-label="Nature">
      <title>Nature</title>
      <path d="M8 3.2c.2-1.1.9-2 2-2.4" stroke={VERT} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M9.6 2.6c1.6-.5 3 .1 3.6 1.2-1.4.5-2.8.2-3.6-1.2z" fill={VERT} />
      <g fill={VERT}>
        <circle cx="5.2" cy="5.4" r="1.7" /><circle cx="8.6" cy="5.4" r="1.7" /><circle cx="11.8" cy="5.6" r="1.5" />
        <circle cx="6.8" cy="8.4" r="1.7" /><circle cx="10.2" cy="8.4" r="1.7" />
        <circle cx="8.5" cy="11.3" r="1.7" /><circle cx="8.6" cy="14.2" r="1.3" />
      </g>
    </svg>
  );
}

/** Pictogrammes d'un vin, dans l'ordre : ♥ coup de cœur, feuille bio, grappe nature. */
export function PictosVin({ coeur, bio, nature }: { coeur?: boolean | null; bio?: boolean | null; nature?: boolean | null }) {
  if (!coeur && !bio && !nature) return null;
  return (
    <span className="pictos-vin">
      {coeur && <span className="coeur" role="img" aria-label="Coup de cœur" title="Coup de cœur de la maison">♥</span>}
      {bio && <span title="Vin bio"><Feuille /></span>}
      {nature && <span title="Vin nature"><Grappe /></span>}
    </span>
  );
}
