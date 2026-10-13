import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { BoutonImprimer } from '@/components/admin/BoutonImprimer';
import { getRestaurantBO } from '@/lib/admin/donnees';
import { adresseApp, qrSvg } from '@/lib/admin/qr';
import { exigerAcces } from '@/lib/admin/auth';

// Identité de Pat (planche 2026) : bordeaux, rouge, rose, kaki ; police Outfit.
const BORDEAUX = '#680021', ROUGE = '#FF0D05', ROSE = '#EB9D92', KAKI = '#BDB074';
const MODELES = [
  { n: 1, titre: 'Modèle 1', aide: 'Bandeau « Pat le sommelier », la question dans le carré rouge' },
  { n: 2, titre: 'Modèle 2', aide: '« Que boire avec ça ? » en bandeau rose, « L’accord parfait » en kaki' },
  { n: 3, titre: 'Modèle 3', aide: 'Un grand carré rouge : la question, Pat et sa signature' },
] as const;

const bande = (fond: string, couleur: string, taille: string): CSSProperties => ({
  background: fond, color: couleur, borderRadius: '3mm', padding: '2.2mm 3mm', textAlign: 'center', fontWeight: 700, fontSize: taille, lineHeight: 1.1,
});
const carreRouge: CSSProperties = { background: ROUGE, borderRadius: '5mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2.5mm', padding: '4mm' };

/** Chevalet de table A6 (105 × 148 mm) aux couleurs de Pat, en trois modèles ; quatre par feuille A4. */
export default async function Chevalet({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ modele?: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const r = await getRestaurantBO(resto);
  if (!r) notFound();
  const modele = [1, 2, 3].includes(Number((await searchParams).modele)) ? Number((await searchParams).modele) : 3;
  const svg = await qrSvg(await adresseApp(resto));

  const qr = (taille: string) => (
    <div style={{ background: '#FFF', borderRadius: '3mm', padding: '2mm', border: `0.5mm solid ${BORDEAUX}`, lineHeight: 0 }}>
      <div style={{ width: taille, height: taille }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
  const scanner = <span style={{ fontSize: '3.2mm', color: BORDEAUX, fontWeight: 600, textAlign: 'center' }}>Scannez : je vous conseille un vin de la carte.</span>;
  const chez = <span style={{ fontSize: '2.8mm', color: '#6B6062' }}>chez {r.nom}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  const pat = (h: string) => <img src="/pat/pat-illustration-bordeaux.svg" alt="" style={{ height: h }} />;

  const contenus: Record<number, ReactNode> = {
    1: (<>
      <div style={bande(BORDEAUX, ROUGE, '5.6mm')}>Pat le sommelier</div>
      <div style={{ ...carreRouge, flexGrow: 1 }}>
        <b style={{ color: BORDEAUX, fontSize: '5mm' }}>Que boire avec ça ?</b>
        {pat('40mm')}
      </div>
      <div style={{ display: 'flex', gap: '3mm', alignItems: 'center' }}>
        {qr('24mm')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2mm', flexGrow: 1 }}>
          <div style={bande(ROSE, ROUGE, '4mm')}>Scannez-moi</div>
          {scanner}{chez}
        </div>
      </div>
    </>),
    2: (<>
      <b style={{ color: BORDEAUX, fontSize: '6.4mm', textAlign: 'center' }}>Pat le sommelier</b>
      <div style={bande(ROSE, ROUGE, '5mm')}>Que boire avec ça ?</div>
      <div style={{ ...carreRouge, flexGrow: 1 }}>{pat('38mm')}</div>
      <div style={bande(KAKI, BORDEAUX, '5mm')}>L’accord parfait</div>
      <div style={{ display: 'flex', gap: '3mm', alignItems: 'center' }}>
        {qr('22mm')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm' }}>{scanner}{chez}</div>
      </div>
    </>),
    3: (<>
      <div style={{ ...carreRouge, flexGrow: 1 }}>
        <b style={{ color: BORDEAUX, fontSize: '8.5mm', lineHeight: 1.05, textAlign: 'center' }}>Que boire<br />avec ça ?</b>
        {pat('42mm')}
        <b style={{ color: BORDEAUX, fontSize: '4.6mm' }}>Pat le sommelier</b>
      </div>
      <div style={{ display: 'flex', gap: '3mm', alignItems: 'center' }}>
        {qr('24mm')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm' }}>{scanner}{chez}</div>
      </div>
    </>),
  };
  const carte = (
    <div style={{ width: '105mm', height: '148mm', boxSizing: 'border-box', border: '0.2mm dashed #CCC', padding: '6mm', display: 'flex', flexDirection: 'column', gap: '3mm',
      background: '#FFF', breakInside: 'avoid', fontFamily: 'Outfit, sans-serif' }}>
      {contenus[modele]}
    </div>
  );
  return (
    <div style={{ padding: 24, background: '#F7F4F2', minHeight: '100vh', fontFamily: 'Outfit, sans-serif' }}>
      <div className="pas-imprime" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <Link href={`/admin/${resto}/acces`}>← Retour</Link>
        <nav aria-label="Modèle de chevalet" style={{ display: 'flex', gap: 8 }}>
          {MODELES.map((m) => (
            <Link key={m.n} href={`/admin/${resto}/acces/chevalet?modele=${m.n}`} title={m.aide} aria-current={modele === m.n ? 'true' : undefined}
              style={{ padding: '8px 14px', borderRadius: 999, fontWeight: 700, textDecoration: 'none', border: `1.5px solid ${BORDEAUX}`,
                background: modele === m.n ? BORDEAUX : '#FFF', color: modele === m.n ? '#FFF' : BORDEAUX }}>{m.titre}</Link>
          ))}
        </nav>
        <BoutonImprimer />
        <span style={{ color: '#6B6062', fontSize: 14 }}>Quatre chevalets A6 par feuille A4 : découpez le long des pointillés.</span>
      </div>
      <style>{`@page { size: A4; margin: 0 } @media print { body { margin: 0 } .pas-imprime { display: none !important } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 105mm)', gap: 0, width: '210mm', background: '#FFF' }}>
        {carte}{carte}{carte}{carte}
      </div>
    </div>
  );
}
