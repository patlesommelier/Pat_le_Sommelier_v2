import Link from 'next/link';
import { notFound } from 'next/navigation';
import { etapesRestaurant } from './etapes';
import { Icone } from '@/components/admin/Icone';
import { BienvenueRestaurant } from '@/components/admin/BienvenueRestaurant';
import { Entete } from '@/components/admin/Ui';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { exigerAcces } from '@/lib/admin/auth';
import { adresseApp, qrSvg } from '@/lib/admin/qr';

export default async function TableauDeBord({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ bienvenue?: string }> }) {
  const { resto } = await params;
  const { bienvenue } = await searchParams;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const [r, s] = await Promise.all([getRestaurantBO(resto), getResume(resto)]);
  if (!r) notFound();
  const etapes = etapesRestaurant(r, s);
  const suivante = etapes.find((e) => e.etat !== 'fait' && e.libelle !== 'Simulateur') ?? etapes[etapes.length - 1];
  const restantes = etapes.filter((e) => e.etat !== 'fait' && e.libelle !== 'Simulateur').length;
  // Tout est en place : l'encart du simulateur montre aussi le QR code de l'app, à droite.
  const qr = suivante.libelle === 'Simulateur' ? await qrSvg(await adresseApp(resto)) : null;
  // Après l'inscription : « Bienvenue », préparation des accords et QR code, à la place de « Prochaine étape ».
  const accueil = Boolean(bienvenue) || (r.origine === 'inscription' && r.statut === 'mise_en_place');
  return (
    <>
      {accueil ? <BienvenueRestaurant restaurantId={r.id} /> : <>
      <Entete titre="Bonjour"
        texte={restantes ? `${restantes > 1 ? `Encore ${restantes} étapes` : 'Encore une étape'} avant de proposer Pat à vos clients.` : 'Tout est en place : Pat conseille vos clients.'} />
      <div className="carte-bo sticker" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat.png" alt="" width={120} height={132} />
        <div className="pile" style={{ flex: '1 1 380px', gap: 12 }}>
          <span className="surtitre">{restantes ? 'Prochaine étape' : 'Et maintenant'}</span>
          <h2 style={{ fontSize: 28, fontWeight: 800 }}>{suivante.libelle}</h2>
          <span className="discret" style={{ fontSize: 15.5 }}>{suivante.ligne1} · {suivante.ligne2}</span>
          <div className="ligne-actions"><Link href={suivante.href} className="btn"><Icone nom={suivante.icone} taille={18} />{suivante.action}</Link></div>
        </div>
        {qr && (
          <Link href={`/admin/${resto}/acces`} aria-label="QR code de l’app : voir les accès" style={{ marginLeft: 'auto' }}>
            <div role="img" aria-label="QR code de l’app" style={{ width: 160, height: 160, padding: 8, border: '1.5px solid var(--encre)', borderRadius: 14, background: '#FFF' }}
              dangerouslySetInnerHTML={{ __html: qr }} />
          </Link>
        )}
      </div>
      </>}
      <section className="pile">
        <div className="grille">
          {etapes.filter((e) => e.libelle !== 'Simulateur').map((e) => (
            <div key={e.href} className={`carte-bo ${e === suivante ? 'sticker' : ''}`} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--rose)', color: 'var(--encre)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icone nom={e.icone} /></span>
              <div className="pile" style={{ gap: 4 }}>
                <h3 style={{ fontSize: 21 }}>{e.libelle}</h3>
                <strong style={{ fontSize: 15 }}>{e.ligne1}</strong>
                <span className="discret">{e.ligne2}</span>
              </div>
              <Link href={e.href} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontWeight: 700, textDecoration: 'none' }}>{e.action}<Icone nom="arrow" taille={16} /></Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
