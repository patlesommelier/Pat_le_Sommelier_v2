// Sections de la page d'accueil : « Ce que je change dans votre restaurant », « Sous le capot »
// et « Qui est vraiment Pat ? ». Textes validés par Pat.
import s from './accueil.module.css';

const Ic = ({ d }: { d: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: d }} />
);

const AVANTAGES = [
  { d: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/>', titre: 'Le même niveau de conseil, tous les soirs',
    texte: 'Que votre meilleur serveur soit en congé ou que la salle soit pleine, chaque client reçoit des vins choisis pour son plat, expliqués simplement.' },
  { d: '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0z"/><path d="M12 14v6M8 21h8"/>', titre: 'Des clients qui osent, et qui reviennent',
    texte: 'Plutôt que de commander le vin de la maison par réflexe, vos clients choisissent celui qui va vraiment avec leur plat. Et un accord réussi, c’est un repas dont on se souvient, et un restaurant où l’on revient.' },
  { d: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M14.5 14.5c.8-.3 1.6-.5 2.5-.5 2.8 0 4 2 4 4"/>',
    titre: 'Une équipe qui respire, et qui progresse',
    texte: 'Vos serveurs n’ont plus à improviser un accord entre deux assiettes. Et à force de m’entendre, ils apprennent les accords de vos plats et les mots pour les expliquer : ils conseillent avec assurance, même quand je ne suis pas là.' },
  { d: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>', titre: 'Aucun vin oublié sur la carte',
    texte: 'Je propose toute votre carte, pas seulement les trois bouteilles que l’équipe connaît par cœur. Chaque référence trouve son plat, et sa table.' },
  { d: '<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
    titre: 'Vous gardez la main sur ce qui se vend',
    texte: 'Un vin à écouler, une nouvelle référence à faire connaître, une gamme de prix à privilégier : vous fixez vos priorités, et je les applique. Toujours parmi les vins qui vont vraiment avec le plat, bien sûr. Je veux bien être arrangeant, pas complaisant.' },
  { d: '<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>', titre: 'Plus de vin vendu, plus de chiffre d’affaires',
    texte: 'Un meilleur conseil fait vendre plus de vin, et mieux. C’est la marge la plus confortable de votre carte, autant qu’elle travaille.' },
];

const FONCTIONNALITES = [
  { d: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 18.5h4"/>', titre: 'Aucune installation',
    texte: 'Vos clients scannent un QR code et me retrouvent dans leur navigateur. Pas d’application à télécharger, pas de compte à créer.' },
  { d: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>', titre: 'Une table d’accords construite pour votre menu',
    texte: 'Chaque vin de votre carte est évalué face à chaque plat, et la table se met à jour quand votre menu ou votre carte change.' },
  { d: '<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
    titre: 'Un espace restaurateur',
    texte: 'Vous y modifiez votre carte, ajustez les accords et fixez vos règles : vins à mettre en avant, gammes de prix, nombre de suggestions par plat.' },
  { d: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>', titre: 'Une carte des vins sur mobile et à imprimer',
    texte: 'Une version consultable sur téléphone, et une version imprimable en un clic, avec une présentation pour chaque vin.' },
  { d: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', titre: 'Une analyse de votre carte',
    texte: 'Je confronte votre carte des vins à votre menu et je vous signale les plats mal servis, les doublons, les pistes à creuser.' },
  { d: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5"/><path d="M21 8v6"/>', titre: 'Un module de formation pour votre équipe',
    texte: 'Vos serveurs y apprennent les accords de vos plats et les mots pour les expliquer.' },
];

export function Avantages() {
  return (
    <section aria-labelledby="h-avantages" className={`${s.creme} ${s.avantages}`}>
      <h2 id="h-avantages" className={s.titreSection}>Ce que je change dans votre restaurant</h2>
      <p className={s.chapeau}>Un bon conseil à chaque table, c’est un client qui ose, une équipe qui souffle… et une caisse qui s’en ressent.</p>
      <ul className={s.cartes}>
        {AVANTAGES.map((a) => (
          <li key={a.titre}><span className={s.icone}><Ic d={a.d} /></span><h3>{a.titre}</h3><p>{a.texte}</p></li>
        ))}
      </ul>
    </section>
  );
}

export function Fonctionnalites() {
  return (
    <section aria-labelledby="h-fonctionnalites" className={`${s.creme} ${s.fonctionnalites}`}>
      <h2 id="h-fonctionnalites" className={s.titreSection}>Sous le capot</h2>
      <ul className={s.fonctions}>
        {FONCTIONNALITES.map((f) => (
          <li key={f.titre}><span className={s.rond}><Ic d={f.d} /></span><span className={s.corps}><h3>{f.titre}</h3><p>{f.texte}</p></span></li>
        ))}
      </ul>
    </section>
  );
}

export function QuiEstPat() {
  return (
    <section aria-labelledby="h-qui" className={`${s.bordeaux} ${s.qui}`}>
      <span className={s.quiMedaillon}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat-logo.png" alt="Pat, le sommelier, porte une grande bouteille" width={172} height={190} />
      </span>
      <div className={s.quiTexte}>
        <h2 id="h-qui">Qui est vraiment Pat ?</h2>
        <p>Derrière ce sommelier virtuel, il y a un vrai sommelier, diplômé du WSET, qui a des dizaines d’années de métier. Il a appris que le vin, c’est simple, mais qu’un bon accord se construit et ne se devine pas. Chaque plat de votre menu est donc confronté à chaque vin de votre carte, selon des principes bien définis : un vin qui répond au plat, des explications simples, et le vigneron beaucoup plus que l’étiquette. Il a l’enthousiasme facile pour les Alpilles, il l’avoue, mais ses accords, eux, sont mûrement réfléchis.</p>
      </div>
    </section>
  );
}
