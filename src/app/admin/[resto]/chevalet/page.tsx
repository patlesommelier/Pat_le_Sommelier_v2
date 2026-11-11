import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { BoutonImprimer } from '@/components/admin/BoutonImprimer';
import { Entete } from '@/components/admin/Ui';
import { getRestaurantBO } from '@/lib/admin/donnees';
import { adresseApp, qrSvg } from '@/lib/admin/qr';
import { exigerAcces } from '@/lib/admin/auth';
import { couleurClaire, logoAffiche } from '@/lib/couleurs';
import { contrasteLogo, couleurDesSupports, fondDuLogo } from '@/lib/couleur-logo';
import { logoPourMasque } from '@/lib/logo-masque';

// Chevalet de table A6 (105 × 148 mm), aux couleurs du restaurant : son logo, sa couleur d'impression (Centre
// d'impression), son nom ; Pat signe discrètement en bas. Quatre par feuille A4.
const MODELES = [
  { n: 1, titre: 'Bandeau', aide: 'Le logo sur un grand bandeau à votre couleur, le QR code sur fond clair' },
  { n: 2, titre: 'Élégant', aide: 'Fond blanc, filet à votre couleur, logo et titre à empattements' },
  { n: 3, titre: 'Plein', aide: 'Tout à votre couleur, le QR code sur une carte blanche' },
] as const;
const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif";

/** Chevalet de table aux couleurs du restaurant, en trois modèles. */
export default async function Chevalet({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ modele?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const brut = await getRestaurantBO(resto);
  if (!brut) notFound();
  const modele = [1, 2, 3].includes(Number((await searchParams).modele)) ? Number((await searchParams).modele) : 1;
  // Logo des impressions (Centre d'impression), sinon ceux de l'app.
  const r = brut.logo_impression_url ? { ...brut, logo_url: brut.logo_impression_url, logo_fonce_url: brut.logo_impression_url } : brut;
  const couleur = (await couleurDesSupports(r, new URLSearchParams())).couleur;
  const surCouleur = await logoSurCouleur(r, couleur);
  const surBlanc = await logoSurBlanc(r, couleur);
  const svg = await qrSvg(await adresseApp(resto));

  // Logo (ou, sans logo, le nom du restaurant) sur la couleur, ou sur le blanc.
  const marque = (fond: 'couleur' | 'blanc', hauteur: string, largeur: string) => {
    const l = fond === 'couleur' ? surCouleur : surBlanc;
    const teinteTexte = fond === 'couleur' ? (couleurClaire(couleur) ? '#241F20' : '#FFFFFF') : couleur;
    if (!l.url) return <span style={{ fontFamily: SERIF, fontSize: '9mm', lineHeight: 1.05, color: teinteTexte, textAlign: 'center' }}>{brut.nom}</span>;
    if (l.teinte) {
      return <span role="img" aria-label={brut.nom} style={{ display: 'block', width: largeur, height: hauteur, background: l.teinte,
        WebkitMaskImage: `url(${logoPourMasque(l.url)})`, maskImage: `url(${logoPourMasque(l.url)})`, WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }} />;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={l.url} alt={brut.nom} style={{ maxWidth: largeur, maxHeight: hauteur, objectFit: 'contain', display: 'block', filter: l.blanc ? 'brightness(0) invert(1)' : undefined }} />;
  };
  const qr = (taille: string, cadre: CSSProperties = {}) => (
    <div style={{ background: '#FFFFFF', padding: '2.5mm', borderRadius: '3mm', lineHeight: 0, ...cadre }}>
      <div style={{ width: taille, height: taille }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
  const consigne = (teinte: string) => (
    <span style={{ fontFamily: SANS, fontSize: '3.1mm', lineHeight: 1.35, color: teinte, textAlign: 'center', maxWidth: '78mm' }}>
      Scannez ce code avec votre téléphone : notre sommelier vous propose le vin de notre carte qui accompagne votre plat.
    </span>
  );
  const signature = (teinte: string, clair = false) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', fontFamily: SANS, fontSize: '2.4mm', color: teinte, opacity: .75 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={clair ? '/pat/pat-avatar-creme.svg' : '/pat/pat-avatar.svg'} alt="" style={{ width: '4.5mm', height: '4.5mm' }} />avec Pat, le sommelier
    </span>
  );
  const titre = (texte: ReactNode, teinte: string, taille = '8mm') => (
    <span className="titre-chevalet" style={{ fontFamily: SERIF, fontSize: taille, lineHeight: 1.08, color: teinte, textAlign: 'center', letterSpacing: '-0.01em' }}>{texte}</span>
  );
  const encre = couleurClaire(couleur) ? '#241F20' : '#FFFFFF';

  const contenus: Record<number, { fond: string; corps: ReactNode }> = {
    // 1. Bandeau : le logo sur la couleur du restaurant, le reste sur un fond clair.
    1: { fond: '#FFFFFF', corps: (<>
      <div style={{ background: couleur, height: '48mm', margin: '-6mm -6mm 0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6mm' }}>
        {marque('couleur', '30mm', '78mm')}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', paddingTop: '5mm' }}>
        {titre(<>Quel vin avec<br /><i>votre plat</i> ?</>, couleur)}
        {qr('32mm', { border: `0.6mm solid ${couleur}` })}
        {consigne('#3B3533')}
        {signature('#3B3533')}
      </div>
    </>) },
    // 2. Élégant : fond blanc, double filet à la couleur, logo et titre à empattements.
    2: { fond: '#FFFFFF', corps: (
      <div style={{ flex: 1, margin: '-1mm', border: `0.5mm solid ${couleur}`, outline: `0.2mm solid ${couleur}`, outlineOffset: '1.2mm',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '7mm 6mm 5mm' }}>
        {marque('blanc', '22mm', '70mm')}
        <span style={{ width: '14mm', height: '0.4mm', background: couleur }} />
        {titre(<><i>Le vin</i> qui accompagne<br />votre plat</>, '#241F20', '7.2mm')}
        {qr('32mm')}
        {consigne('#3B3533')}
        {signature('#3B3533')}
      </div>
    ) },
    // 3. Plein : tout à la couleur, le QR code sur une carte blanche.
    3: { fond: couleur, corps: (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '2mm 0 0' }}>
        {marque('couleur', '24mm', '74mm')}
        {titre(<>Quel vin avec<br /><i>votre plat</i> ?</>, encre)}
        {qr('34mm', { boxShadow: '0 1.5mm 4mm rgba(0,0,0,.18)' })}
        {consigne(encre)}
        {signature(encre, encre === '#FFFFFF')}
      </div>
    ) },
  };
  const c = contenus[modele];
  const carte = (
    <div style={{ width: '105mm', height: '148mm', boxSizing: 'border-box', outline: '0.2mm dashed #AFB0AE', outlineOffset: '-0.1mm', padding: '6mm', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: '3mm', background: c.fond, breakInside: 'avoid', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {c.corps}
    </div>
  );
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Inter:wght@400;600&display=swap" />
      <style>{`.titre-chevalet i { font-family: ${SERIF} !important; font-style: italic; }
        .feuille-chevalets { display: none; }
        @page { size: A4; margin: 0 }
        @media print { body { margin: 0 } .feuille-chevalets { display: grid; } }`}</style>
      {/* À l'écran, comme la carte des vins du Centre d'impression : les modèles à gauche, l'aperçu à droite, puis l'impression. */}
      <div className="pas-imprime pile" style={{ gap: 24 }}>
        <Entete titre="Impression du chevalet" texte="Un chevalet A6 à poser sur vos tables, à vos couleurs : vos clients scannent le QR code et Pat leur conseille un vin de votre carte. Le logo et la couleur se règlent dans « Impression de la carte des vins »." />
        <section className="carte-bo pile">
          <div className="impression-carte">
            <div role="radiogroup" aria-label="Modèle de chevalet" className="pile" style={{ gap: 8, flex: '1 1 260px', minWidth: 0 }}>
              {MODELES.map((m) => (
                <Link key={m.n} href={`/admin/${resto}/chevalet?modele=${m.n}`} role="radio" aria-checked={modele === m.n} className="design-carte"
                  data-choisi={modele === m.n ? 'oui' : undefined} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span aria-hidden="true" style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, borderRadius: '50%', boxSizing: 'border-box',
                    border: modele === m.n ? '5px solid var(--encre)' : '1.5px solid var(--ligne-forte)' }} />
                  <span className="pile" style={{ gap: 2 }}><b>{m.titre}</b><small className="discret">{m.aide}</small></span>
                </Link>
              ))}
              <div className="ligne-actions" style={{ marginTop: 8 }}><BoutonImprimer /></div>
              <span className="discret" style={{ fontSize: 13 }}>Quatre chevalets par feuille A4 : découpez le long des pointillés.</span>
            </div>
            {/* Aperçu du chevalet choisi. */}
            <div aria-label="Aperçu du chevalet" style={{ flex: '0 0 auto', boxShadow: '0 10px 30px -14px rgba(36,31,32,.35)', fontFamily: SANS }}>{carte}</div>
          </div>
        </section>
      </div>
      {/* À l'impression seulement : la feuille A4 avec quatre chevalets. */}
      <div className="feuille-chevalets" style={{ gridTemplateColumns: 'repeat(2, 105mm)', gap: 0, width: '210mm', background: '#FFFFFF', fontFamily: SANS }}>
        {carte}{carte}{carte}{carte}
      </div>
    </>
  );
}

type Logos = { couleur: string; logo_url: string | null; logo_fonce_url: string | null; logo_choix: string | null };

/** Logo posé sur la couleur : le clair sur une couleur foncée (sinon le foncé) ; passé en blanc s'il ne s'y voit pas. */
async function logoSurCouleur(r: Logos, couleur: string): Promise<{ url: string | null; blanc?: boolean; teinte?: string }> {
  const url = couleurClaire(couleur) ? r.logo_fonce_url ?? logoAffiche({ ...r, couleur })?.url ?? null : r.logo_url ?? r.logo_fonce_url;
  if (!url) return { url: null };
  const [contraste, fondClair] = await Promise.all([contrasteLogo(url, couleur), fondDuLogo(url)]);
  return { url, blanc: !fondClair && !couleurClaire(couleur) && contraste != null && contraste < 2.2 };
}

/** Logo posé sur le blanc : le foncé ; un logo clair sans fond (invisible sur le blanc) est imprimé à la couleur. */
async function logoSurBlanc(r: Logos, couleur: string): Promise<{ url: string | null; blanc?: boolean; teinte?: string }> {
  const url = r.logo_fonce_url ?? r.logo_url;
  if (!url) return { url: null };
  const [contraste, fondClair] = await Promise.all([contrasteLogo(url, '#FFFFFF'), fondDuLogo(url)]);
  return !fondClair && contraste != null && contraste < 1.8 ? { url, teinte: couleur } : { url };
}
