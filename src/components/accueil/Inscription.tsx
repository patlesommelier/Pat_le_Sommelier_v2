'use client';
// Formulaire doré « Activez votre sommelier en quelques minutes » (niveau 3 de la page) : une étape à la fois.
// 1/3 carte des vins → 2/3 menu → 3/3 restaurant (compte) et « J’engage Pat » (accords et QR code).
// Après chaque dépôt, seul le nombre d'éléments trouvés s'affiche.
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import s from './accueil.module.css';
import { PatAttente } from '@/components/PatAttente';
import { commencer, deposer, type Reponse } from '@/lib/inscription/actions';
import type { Etape, ResumePublic, TypeAnalyse } from '@/lib/inscription/etapes';
import { reduire } from '@/lib/reduire-image';
import { Preparation } from './Preparation';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';
const TEXTES: Record<TypeAnalyse, { depot: string; lecture: string; unite: string }> = {
  carte: { depot: 'Déposez votre carte des vins pour que je l’analyse', lecture: 'Pat lit votre carte des vins…', unite: 'vins trouvés' },
  menu: { depot: 'Déposez votre menu pour que je l’analyse', lecture: 'Pat lit votre menu…', unite: 'plats trouvés' },
};

/**
 * Une étape : son numéro (« 1/3 ») à côté de son contenu ; l'intitulé reste lu par les lecteurs d'écran.
 * `suite` : petit bouton rond à flèche vers le haut, à droite, pour passer à l'étape suivante une fois le fichier lu.
 */
const EtapeNumerotee = ({ n, titre, children, suite }: {
  n: number; titre: string; children: React.ReactNode; suite?: { pret: boolean; aller: () => void };
}) => (
  <div className={s.etapeLigne}>
    <h3 className={s.etapeNum}>{n}/3<span className={s.cacher}> : {titre}</span></h3>
    <div className={s.etapeContenu}>{children}</div>
    {suite && (
      <button type="button" className={s.suivant} disabled={!suite.pret} onClick={suite.aller} aria-label="Continuer" title="Continuer">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
      </button>
    )}
  </div>
);

const IconeEnvoi = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" />
  </svg>
);
const Coche = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg>
);

function Erreurs({ liste }: { liste: string[] }) {
  if (!liste.length) return null;
  return <ul className={s.erreurs} role="alert">{liste.map((e) => <li key={e}>{e}</li>)}</ul>;
}

/** Dépôt d'un ou plusieurs fichiers ; l'envoi part dès la sélection ou le glisser-déposer. */
function Depot({ type, etat, onReponse }: {
  type: TypeAnalyse; etat: ResumePublic['carte']; onReponse: (r: Reponse) => void;
}) {
  const [reponse, envoyer, enCours] = useActionState(deposer.bind(null, type), { erreurs: [] } as Reponse);
  const [survol, setSurvol] = useState(false);
  const [prepare, setPrepare] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (reponse.resume || reponse.erreurs.length) onReponse(reponse); }, [reponse, onReponse]);

  const envoyerFichiers = async (liste: FileList | null) => {
    if (!liste?.length) return;
    setPrepare(true);
    const fichiers = await Promise.all([...liste].map(reduire));
    setPrepare(false);
    const fd = new FormData();
    fichiers.forEach((f) => fd.append('fichiers', f));
    startTransition(() => envoyer(fd));
    if (input.current) input.current.value = '';
  };

  const t = TEXTES[type];
  if (prepare || enCours || etat?.statut === 'en_cours') {
    return <div className={s.attente} role="status" aria-live="polite"><PatAttente taille={52} />{prepare ? 'Préparation des fichiers…' : t.lecture}</div>;
  }
  const remplacer = etat?.statut === 'ok';
  const champ = (
    <input ref={input} className={s.cacher} type="file" name="fichiers" multiple accept={ACCEPT} id={`f-${type}`}
      onChange={(e) => envoyerFichiers(e.currentTarget.files)} />
  );
  return (
    <div>
      {remplacer ? (
        <div className={s.trouve} role="status">
          <span className={s.coche}><Coche /></span>
          <span className={s.nombre}>{etat?.nombre} {t.unite}</span>
          <label className={s.lien} htmlFor={`f-${type}`}>Remplacer</label>
          {champ}
        </div>
      ) : (
        <label className={s.depot} htmlFor={`f-${type}`} data-survol={survol}
          onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => { e.preventDefault(); setSurvol(false); envoyerFichiers(e.dataTransfer.files); }}>
          <span className={s.icone}><IconeEnvoi /></span>
          <span>{t.depot}<br /><span style={{ fontWeight: 700, fontSize: 13, color: '#241F20' }}>Photos ou PDF, une image par page · glissez-les ici ou cliquez</span></span>
          {champ}
        </label>
      )}
      <Erreurs liste={[...(etat?.statut === 'erreur' && etat.message ? [etat.message] : []), ...reponse.erreurs]} />
    </div>
  );
}

function BoutonEnvoi({ libelle, enCours, desactive = false }: { libelle: string; enCours: string; desactive?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={s.bouton} disabled={pending || desactive} aria-busy={pending}>{pending ? enCours : libelle}</button>;
}

export function Inscription({ initial, restaurantCree }: { initial: ResumePublic; restaurantCree: string | null }) {
  const [resume, setResume] = useState(initial);
  const [etape, setEtape] = useState<Etape>(initial.etape);
  const [compte, envoyerCompte] = useActionState(commencer, { erreurs: [] } as Reponse);
  // Session expirée pendant l'inscription : retour à la carte des vins.
  useEffect(() => { if (compte.resume) { setResume(compte.resume); if (!compte.resume.carte) setEtape('carte'); } }, [compte]);

  // Tant qu'une lecture est en cours, on interroge le serveur toutes les 3 secondes.
  const lecture = resume.carte?.statut === 'en_cours' || resume.menu?.statut === 'en_cours';
  useEffect(() => {
    if (!lecture) return;
    const t = setInterval(async () => {
      const r = await fetch('/api/inscription/statut', { cache: 'no-store' });
      if (r.ok) setResume(await r.json());
    }, 3000);
    return () => clearInterval(t);
  }, [lecture]);

  // Inscription expirée entre-temps : retour à la première étape (carte des vins).
  const surReponse = useCallback((r: Reponse) => {
    if (!r.resume) return;
    setResume(r.resume);
    if (!r.resume.carte) setEtape('carte');
  }, []);
  const cree = compte.restaurantId ?? restaurantCree;

  return (
    <div className={s.cadre}>
      <section className={s.carte} aria-labelledby="h-insc">
        <h2 id="h-insc" className={s.cacher}>Inscription</h2>

        {/* Restaurant créé : Pat prépare les accords, puis le QR code s'affiche ici. */}
        {cree && <Preparation restaurantId={cree} />}

        {!cree && etape === 'carte' && <>
          <EtapeNumerotee n={1} titre="Envoyez-nous votre carte des vins" suite={{ pret: resume.carte?.statut === 'ok', aller: () => setEtape('menu') }}>
            <Depot type="carte" etat={resume.carte} onReponse={surReponse} />
          </EtapeNumerotee>
        </>}

        {!cree && etape === 'menu' && <>
          <EtapeNumerotee n={2} titre="Envoyez-nous votre menu" suite={{ pret: resume.menu?.statut === 'ok', aller: () => setEtape('restaurant') }}>
            <Depot type="menu" etat={resume.menu} onReponse={surReponse} />
          </EtapeNumerotee>
          <div className={s.pied}>
            <button type="button" className={s.retour} onClick={() => setEtape('carte')}>Retour</button>
          </div>
        </>}

        {!cree && etape === 'restaurant' && (
          <form action={envoyerCompte} className={s.champs}>
            <EtapeNumerotee n={3} titre="Votre restaurant">
              <div className={s.champ}><label htmlFor="nom">Nom du restaurant</label><input id="nom" name="nom" required autoComplete="organization" placeholder="Ex. Le Comptoir" /></div>
            </EtapeNumerotee>
            <div className={s.ligne}>
              <div className={s.champ}><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@restaurant.be" /></div>
              <div className={s.champ}><label htmlFor="motDePasse">Mot de passe</label><input id="motDePasse" name="motDePasse" type="password" required autoComplete="new-password" placeholder="12 caractères minimum" /></div>
            </div>
            <label className={s.cgu}><input type="checkbox" name="cgu" required /><span>J’accepte les <a href="/conditions" target="_blank" rel="noopener">conditions d’utilisation</a></span></label>
            <Erreurs liste={compte.erreurs} />
            <div className={s.pied}>
              <button type="button" className={s.retour} onClick={() => setEtape('menu')}>Retour</button>
              <BoutonEnvoi libelle="J’engage Pat" enCours="Un instant…" desactive={resume.carte?.statut !== 'ok' || resume.menu?.statut !== 'ok'} />
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
