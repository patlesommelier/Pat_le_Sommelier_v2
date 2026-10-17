import Link from 'next/link';
import { notFound } from 'next/navigation';
import { etapesRestaurant } from './etapes';
import { Icone } from '@/components/admin/Icone';
import { BienvenueRestaurant } from '@/components/admin/BienvenueRestaurant';
import { Entete } from '@/components/admin/Ui';
import { getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { exigerAcces, prenomUtilisateur } from '@/lib/admin/auth';

// Les trois cadres du tableau de bord ; le reste (règles, apparence, accès, simulateur) est dans le menu de gauche.
const CADRES: Record<string, string> = { Menu: 'Gérer mon menu', 'Carte des vins': 'Gérer ma carte des vins', Accords: 'Gérer mes accords' };

export default async function TableauDeBord({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ bienvenue?: string }> }) {
  const { resto } = await params;
  const { bienvenue } = await searchParams;
  const u = await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const [r, s, prenom] = await Promise.all([getRestaurantBO(resto), getResume(resto), prenomUtilisateur(u, resto)]);
  if (!r) notFound();
  const etapes = etapesRestaurant(r, s).filter((e) => e.libelle in CADRES);
  // Après l'inscription : « Bienvenue », préparation des accords et QR code, à la place du résumé.
  const accueil = Boolean(bienvenue) || (r.origine === 'inscription' && r.statut === 'mise_en_place');
  const resume: [number, string, string][] = [[s.plats, 'plat', 'plats au menu'], [s.vins, 'vin', 'vins à la carte'], [s.accords, 'accord', 'accords mets-vins']];
  return (
    <>
      {accueil ? <BienvenueRestaurant restaurantId={r.id} /> : <>
      <Entete titre={prenom ? `Bonjour ${prenom}` : 'Bonjour'} />
      {/* Résumé général du restaurant */}
      <div className="carte-bo sticker" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pat/pat-attable-rouge.svg" alt="" width={166} height={130} />
        <div style={{ flex: '1 1 380px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          {resume.map(([n, un, plusieurs]) => (
            <div key={un} style={{ padding: '16px 18px', borderRadius: 14, background: 'var(--fond)', border: '1px solid var(--ligne)' }}>
              <div className="chiffre" style={{ fontSize: 36, lineHeight: 1.1 }}>{n.toLocaleString('fr-BE')}</div>
              <div style={{ fontSize: 15 }}>{n > 1 ? plusieurs : plusieurs.replace(/^\S+/, un)}</div>
            </div>
          ))}
        </div>
      </div>
      </>}
      <section className="pile">
        <div className="grille">
          {etapes.map((e) => (
            <div key={e.href} className="carte-bo" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--rose)', color: 'var(--encre)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icone nom={e.icone} /></span>
              <div className="pile" style={{ gap: 4 }}>
                <h3 style={{ fontSize: 21 }}>{CADRES[e.libelle]}</h3>
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
