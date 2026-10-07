// Sections crème de la page d'accueil : « Qu'est-ce que Pat vous apporte ? » et « Fonctionnalités ».
// Textes rédigés pour la maquette : à relire par Pat avant la mise en ligne.
import s from './accueil.module.css';

const Ic = ({ d }: { d: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: d }} />
);

const AVANTAGES = [
  { d: '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0z"/><path d="M12 14v6M8 21h8"/>', titre: 'Plus de vin à chaque table',
    texte: 'Guidés par Pat, vos clients osent la bouteille ou le verre qui va vraiment avec leur plat.' },
  { d: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M14.5 14.5c.8-.3 1.6-.5 2.5-.5 2.8 0 4 2 4 4"/>',
    titre: 'Un sommelier même au coup de feu', texte: 'Chaque client reçoit un conseil personnalisé, même quand votre équipe est débordée.' },
  { d: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>', titre: 'Votre carte mise en valeur',
    texte: 'Chaque vin est présenté avec quelques mots justes, et vous imprimez une belle carte en un clic.' },
  { d: '<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
    titre: 'Vous gardez la main', texte: 'Ajustez les accords et les règles depuis votre espace : Pat suit vos choix.' },
];

const FONCTIONNALITES = [
  { d: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', titre: 'Sommelier en temps réel',
    texte: 'À table, vos clients choisissent leur plat et reçoivent aussitôt des vins de votre carte, expliqués simplement.' },
  { d: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 18.5h4"/><path d="M3 7v12h3M21 7v12h-3" opacity="0.7"/>',
    titre: 'Carte des vins digitale et imprimable', texte: 'Votre carte consultable sur mobile, et une version imprimable élégante, avec une présentation pour chaque vin.' },
  { d: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="M14 7l3-3 3 3" opacity="0.7"/>', titre: 'Analyse de la carte et améliorations',
    texte: 'Pat analyse votre carte des vins face à votre menu et vous propose des pistes pour l’améliorer.' },
  { d: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5"/><path d="M21 8v6"/>', titre: 'Formation du personnel',
    texte: 'Votre équipe apprend les accords de vos plats et les mots pour conseiller les clients avec assurance.' },
];

export function Avantages() {
  return (
    <section aria-labelledby="h-avantages" className={`${s.creme} ${s.avantages}`}>
      <h2 id="h-avantages" className={s.titreSection}>Qu’est-ce que Pat vous apporte ?</h2>
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
      <h2 id="h-fonctionnalites" className={s.titreSection}>Fonctionnalités</h2>
      <ul className={s.fonctions}>
        {FONCTIONNALITES.map((f) => (
          <li key={f.titre}><span className={s.rond}><Ic d={f.d} /></span><span className={s.corps}><h3>{f.titre}</h3><p>{f.texte}</p></span></li>
        ))}
      </ul>
    </section>
  );
}
