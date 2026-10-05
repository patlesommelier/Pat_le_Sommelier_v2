import Link from 'next/link';
import { redirect } from 'next/navigation';
import s from '../inscription.module.css';
import { Etapes, ZoneEnvoi } from '../composants';
import { envoyerLogo } from '../actions';
import { inscriptionCourante } from '@/lib/inscription/etat';

export default async function Logo() {
  const i = await inscriptionCourante();
  if (!i) redirect('/inscription');
  if (!i.vins.length) redirect('/inscription/vins');
  // Aperçu servi par /inscription/logo/apercu, réservé à cette inscription (cookie).
  const apercu = i.logo_fichier ? `/inscription/logo/apercu?v=${i.logo_fichier}` : null;
  return (
    <>
      <main className={s.contenu}>
        <Etapes etape={3} />
        <h1 className={s.titre}>Votre logo</h1>
        <p className={s.texte}>Il apparaît en haut de l’app que vos clients ouvrent en scannant le QR code.</p>
        {apercu && (
          <div style={{ alignSelf: 'center', width: 220, height: 110, borderRadius: 14, background: i.couleur ?? '#610420',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={apercu} alt="Votre logo" style={{ maxWidth: 170, maxHeight: 80 }} />
          </div>
        )}
        <ZoneEnvoi action={envoyerLogo} accept="image/png,image/svg+xml,image/jpeg,image/webp" multiple={false} photo={false} reduireImages={false}
          enCours="Envoi du logo…" />
        {i.logo_clair === true && <p className={s.carte} style={{ margin: 0 }}>Logo clair détecté : Pat le posera sur votre couleur. Pour la carte imprimée en noir et blanc, une version foncée pourra être ajoutée plus tard.</p>}
        {i.logo_clair === false && <p className={s.alerte} style={{ margin: 0 }}>Votre logo est foncé : sur la couleur de l’app, il risque de manquer de contraste. Une version claire (blanche) donnera un meilleur rendu ; vous pourrez l’ajouter plus tard dans votre espace.</p>}
      </main>
      <div className={s.barreAction}><div>
        <Link href="/inscription/couleur" className={s.bouton}>Continuer</Link>
        {!apercu && <Link href="/inscription/couleur" className={s.lien}>Passer cette étape</Link>}
      </div></div>
    </>
  );
}
