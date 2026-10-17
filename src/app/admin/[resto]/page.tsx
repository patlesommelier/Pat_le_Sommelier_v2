import { notFound } from 'next/navigation';
import { BienvenueRestaurant } from '@/components/admin/BienvenueRestaurant';
import { Entete } from '@/components/admin/Ui';
import { getRegleDuJour, getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { exigerAcces, prenomUtilisateur } from '@/lib/admin/auth';
import { titreCarte } from '@/lib/admin/intitule';
import { avecAppreciation } from '@/lib/appreciation';
import { sansContenance } from '@/lib/format';

/** Tableau de bord : bonjour, ce que Pat permet de faire, le résumé du restaurant et la règle de Pat du jour. */
export default async function TableauDeBord({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ bienvenue?: string }> }) {
  const { resto } = await params;
  const { bienvenue } = await searchParams;
  const u = await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const [r, s, prenom, jour] = await Promise.all([getRestaurantBO(resto), getResume(resto), prenomUtilisateur(u, resto), getRegleDuJour(resto)]);
  if (!r) notFound();
  // Après l'inscription : « Bienvenue », préparation des accords et QR code, à la place du résumé.
  const accueil = Boolean(bienvenue) || (r.origine === 'inscription' && r.statut === 'mise_en_place');
  const resume: [number, string, string][] = [[s.plats, 'plat', 'plats au menu'], [s.vins, 'vin', 'vins à la carte'], [s.accords, 'accord', 'accords mets-vins']];
  const vin = jour && titreCarte(jour.vin);
  return (
    <>
      {accueil ? <BienvenueRestaurant restaurantId={r.id} /> : <>
      <Entete titre={prenom ? `Bonjour ${prenom}` : 'Bonjour'}
        texte="Avec Pat le Sommelier, chacun de vos clients choisit son plat sur son téléphone et découvre le vin de votre carte qui l’accompagne le mieux, avec une explication simple, comme le ferait un sommelier à table. Ici, vous gardez la main : tenez votre menu et votre carte des vins à jour, relisez les accords que Pat a préparés, ajustez ses règles à votre service, choisissez l’apparence de votre app et imprimez le QR code à poser sur vos tables." />
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

      {/* La règle de Pat du jour : une de ses règles, illustrée par le meilleur vin de la carte pour un plat du menu. */}
      {jour && vin && (
        <section className="carte-bo" style={{ display: 'flex', flexDirection: 'column', gap: 18 }} aria-labelledby="regle-du-jour">
          <div className="pile" style={{ gap: 8 }}>
            <span className="surtitre" id="regle-du-jour">La règle de Pat du jour</span>
            <h2 style={{ fontSize: 26 }}>{jour.titre}</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, maxWidth: '75ch' }}>{jour.regle}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-start', padding: 20, borderRadius: 14, background: 'var(--fond)', border: '1px solid var(--ligne)' }}>
            {jour.vin.etiquette_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={jour.vin.etiquette_url} alt={`Étiquette : ${jour.vin.libelle}`} style={{ width: 150, maxHeight: 210, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
            )}
            <div className="pile" style={{ flex: '1 1 320px', gap: 10 }}>
              <span className="surtitre">Avec : {jour.plat}</span>
              <div>
                <h3 style={{ fontSize: 21 }}>{vin.titre}</h3>
                {vin.sousTitre && <span className="discret" style={{ fontSize: 15 }}>{vin.sousTitre}</span>}
              </div>
              {jour.vin.presentation && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{sansContenance(jour.vin.presentation)}</p>}
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, paddingLeft: 14, borderLeft: '3px solid var(--rouge)' }}>
                {avecAppreciation(jour.explication, jour.note, { cle: jour.plat_id, ecritParLeRestaurant: jour.ecrit_par_le_restaurant })}
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
