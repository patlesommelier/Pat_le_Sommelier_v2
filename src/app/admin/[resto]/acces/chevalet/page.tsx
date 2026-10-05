import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BoutonImprimer } from '@/components/admin/BoutonImprimer';
import { getRestaurantBO } from '@/lib/admin/donnees';
import { adresseApp, qrSvg } from '@/lib/admin/qr';
import { couleurClaire } from '@/lib/couleurs';
import { exigerAcces } from '@/lib/admin/auth';

/** Chevalet de table A6 (105 × 148 mm), quatre par feuille A4. */
export default async function Chevalet({ params }: { params: Promise<{ resto: string }> }) {
  const { resto } = await params;
  await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const r = await getRestaurantBO(resto);
  if (!r) notFound();
  const svg = await qrSvg(await adresseApp(resto));
  const clair = couleurClaire(r.couleur);
  const logo = (clair && r.logo_fonce_url) || r.logo_url;
  const carte = (
    <div style={{ width: '105mm', height: '148mm', boxSizing: 'border-box', border: '0.2mm dashed #CCC', display: 'flex', flexDirection: 'column', background: '#FFF', breakInside: 'avoid' }}>
      <div style={{ background: r.couleur, padding: '6mm', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '24mm', color: clair ? '#1A1A1A' : '#FFF' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt={r.nom} style={{ maxHeight: '16mm', maxWidth: '60mm' }} /> : <b style={{ fontSize: '8mm' }}>{r.nom}</b>}
      </div>
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3mm', padding: '5mm', textAlign: 'center', fontFamily: 'Lato, sans-serif', color: '#1A1A1A' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat.png" alt="" style={{ height: '17mm' }} />
        <b style={{ fontSize: '5.2mm', lineHeight: 1.2 }}>Un vin pour votre plat ?</b>
        <span style={{ fontSize: '3.4mm', lineHeight: 1.35, color: '#444' }}>Scannez : Pat, notre sommelier, vous conseille un vin de la carte.</span>
        <div style={{ width: '42mm', height: '42mm' }} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
  return (
    <div style={{ padding: 24, background: '#FBF8F7', minHeight: '100vh' }}>
      <div className="pas-imprime" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, fontFamily: 'Lato, sans-serif' }}>
        <Link href={`/admin/${resto}/acces`}>← Retour</Link>
        <BoutonImprimer />
        <span style={{ color: '#66565B', fontSize: 14 }}>Quatre chevalets A6 par feuille A4 : découpez le long des pointillés.</span>
      </div>
      <style>{`@page { size: A4; margin: 0 } @media print { body { margin: 0 } .pas-imprime { display: none !important } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 105mm)', gap: 0, width: '210mm', background: '#FFF' }}>
        {carte}{carte}{carte}{carte}
      </div>
    </div>
  );
}
