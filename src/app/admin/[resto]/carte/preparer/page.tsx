import Link from 'next/link';
import { ActualisationAuto } from '@/components/admin/ActualisationAuto';
import { RedirectionAuto } from '@/components/admin/RedirectionAuto';
import { Entete } from '@/components/admin/Ui';
import { exigerAcces } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { etatPresentations, preparationEnCours, presentationsManquantes } from '@/lib/generation/file-presentations';

export const dynamic = 'force-dynamic';

const COULEURS: Record<string, string> = { bulles: 'Bulles', blanc: 'Blancs', rose: 'Rosés', rouge: 'Rouges', orange: 'Orange', doux: 'Doux' };
const STATUTS: Record<string, string> = { en_attente: 'en attente', en_cours: 'Pat écrit…', fait: 'prêt', erreur: 'échec' };

/** Page d'attente du bouton « Imprimer la carte » : Pat écrit les présentations manquantes, puis la carte s'ouvre toute seule. */
export default async function Preparer({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto);
  const imprimer = `/admin/${resto}/carte/imprimer`;
  const [etat, enCours, manquantes] = await Promise.all([etatPresentations(requete, resto), preparationEnCours(requete, resto), presentationsManquantes(requete, resto)]);
  const termine = !enCours && (etat?.termine ?? true);
  const reste = manquantes.reduce((s, m) => s + m.n, 0);
  const erreurs = etat?.couleurs.filter((c) => c.statut === 'erreur') ?? [];
  // S'il y a eu un échec, on laisse le message affiché : la carte s'ouvre par le bouton.
  const ouvrir = termine && !erreurs.length;

  return (
    <>
      <Entete titre="Préparation de la carte" texte="Pat rédige la présentation des vins qui n’en ont pas encore. Les textes existants et ceux que vous avez corrigés ne sont pas modifiés.">
        <Link href={`/admin/${resto}/carte`} className="btn sec">← Carte des vins</Link>
        <a href={imprimer} className="btn">{termine ? 'Ouvrir la carte' : 'Imprimer sans attendre'}</a>
      </Entete>
      <div className="carte-bo pile" style={{ gap: 8, padding: '16px 20px' }} aria-live="polite">
        {!termine && <ActualisationAuto />}
        {ouvrir && <RedirectionAuto href={imprimer} />}
        <strong>{termine ? (ouvrir ? 'Présentations prêtes : ouverture de la carte…' : 'Préparation terminée') : 'Pat écrit les présentations…'}</strong>
        {!termine && <span className="discret">Comptez une à trois minutes ; les couleurs sont traitées en parallèle. La carte s’ouvrira toute seule.</span>}
        {etat?.couleurs.map((c) => (
          <span key={c.couleur}>
            {COULEURS[c.couleur] ?? c.couleur} : {STATUTS[c.statut] ?? c.statut}
            {c.statut === 'fait' && c.message ? ` (${c.message.replace('/', ' sur ')})` : ''}
          </span>
        ))}
        {erreurs.map((c) => (
          <span key={c.couleur} className="message" style={{ background: 'var(--ocre-fond)', color: 'var(--ocre)', margin: 0 }}>
            {COULEURS[c.couleur] ?? c.couleur} : {c.message ?? 'échec'} — ces vins gardent leur résumé court sur la carte. Recliquez sur « Imprimer la carte » pour réessayer.
          </span>
        ))}
        {termine && reste > 0 && !erreurs.length && <span className="discret">{reste} vin{reste > 1 ? 's' : ''} sans présentation valide : résumé court sur la carte, à compléter dans la fiche du vin.</span>}
      </div>
    </>
  );
}
