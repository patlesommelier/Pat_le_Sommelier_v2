import { redirect } from 'next/navigation';
import s from '../inscription.module.css';
import { Etapes } from '../composants';
import { ChoixCouleur } from './choix';
import { inscriptionCourante } from '@/lib/inscription/etat';
import { couleursProposees } from '@/lib/inscription/couleurs';

export default async function Couleur() {
  const i = await inscriptionCourante();
  if (!i) redirect('/inscription');
  if (!i.vins.length) redirect('/inscription/vins');
  const propositions = i.couleurs_proposees.length ? i.couleurs_proposees : couleursProposees(new Uint8Array());
  const logo = i.logo_fichier ? `/inscription/logo/apercu?v=${i.logo_fichier}` : null;
  return (
    <main className={s.contenu}>
      <Etapes etape={4} />
      <h1 className={s.titre}>Votre couleur</h1>
      <p className={s.texte}>
        {propositions[0]?.duLogo ? 'Pat l’a tirée de votre logo. '
          : i.logo_fichier ? 'Votre logo n’a pas de couleur marquée : choisissez celle de votre établissement. ' : ''}
        Elle colore l’app de vos clients et votre carte imprimée.
      </p>
      <ChoixCouleur propositions={propositions} initiale={i.couleur ?? propositions[0].hex} logo={logo}
        nom={i.nom_restaurant ?? ''} plats={i.plats.slice(0, 3).map((p) => p.nom)} />
    </main>
  );
}
