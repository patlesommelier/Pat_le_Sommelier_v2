import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ilYA, inventaireARefaire } from '@/lib/admin/inventaire';
import { BienvenueRestaurant } from '@/components/admin/BienvenueRestaurant';
import { Entete } from '@/components/admin/Ui';
import { aVerifierLecture, getRegleDuJour, getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { AnnonceCave, MiseEnRoute } from '@/components/admin/MiseEnRoute';
import { adresseApp } from '@/lib/admin/qr';
import { exigerAcces, prenomUtilisateur } from '@/lib/admin/auth';
import { titreCarte } from '@/lib/admin/intitule';
import { avecAppreciation } from '@/lib/appreciation';
import { sansContenance } from '@/lib/format';

/** Tableau de bord : bonjour, l'espace Quid Vinum (et Pat le Sommelier pour les accords), le résumé du restaurant et la règle de Pat du jour. */
export default async function TableauDeBord({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ bienvenue?: string }> }) {
  const { resto } = await params;
  const { bienvenue } = await searchParams;
  const u = await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const [r, s, prenom, jour] = await Promise.all([getRestaurantBO(resto), getResume(resto), prenomUtilisateur(u, resto), getRegleDuJour(resto)]);
  if (!r) notFound();
  // Après l'inscription : « Bienvenue », préparation des accords et QR code, à la place du résumé.
  const accueil = Boolean(bienvenue) || (r.origine === 'inscription' && r.statut === 'mise_en_place');
  // Restaurant inscrit seul, app ouverte, mais pas encore de premier client : « Votre mise en route » (3 pas).
  const miseEnRoute = !accueil && r.origine === 'inscription' && !r.premier_client_le;
  const annonceCave = !accueil && r.origine === 'inscription' && Boolean(r.premier_client_le) && !r.cave_annonce_fermee_le && !u.admin;
  const [app, verifier] = miseEnRoute ? await Promise.all([adresseApp(r.id), aVerifierLecture(r.id)]) : [null, null];
  const resume: [number, string, string][] = [[s.plats, 'plat', 'plats au menu'], [s.vins, 'vin', 'vins à la carte'], [s.accords, 'accord', 'accords mets-vins']];
  const vin = jour && titreCarte(jour.vin);
  return (
    <>
      {accueil ? <BienvenueRestaurant restaurantId={r.id} /> : <>
      <Entete titre={prenom ? `Bonjour ${prenom}` : 'Bonjour'}
        texte="Votre espace Quid Vinum : votre menu et votre carte des vins, vos vins en stock et vos commandes à vos distributeurs. Pour les accords mets-vins, Pat le Sommelier accompagne vos clients : chacun choisit son plat sur son téléphone et découvre le vin de votre carte qui l’accompagne le mieux, comme le ferait un sommelier à table. Vous gardez la main : relisez les accords que Pat a préparés, ajustez ses règles à votre service, choisissez l’apparence de l’app et imprimez le QR code à poser sur vos tables." />
      {miseEnRoute && app && verifier && <MiseEnRoute resto={r.id} app={app} exemple={jour} verifier={verifier} />}
      {/* Après le premier client : la Gestion de cave apparaît, annoncée une fois (bandeau à fermer). */}
      {annonceCave && <AnnonceCave resto={r.id} />}
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

      {/* Inventaire à refaire (jamais fait, ou plus de 7 jours) : un message, avec le lien vers la page Inventaire. */}
      {!accueil && !miseEnRoute && !annonceCave && s.vins > 0 && inventaireARefaire(r.inventaire_le) && (
        <section className="carte-bo rappel-inventaire" aria-label="Inventaire">
          <div className="pile" style={{ gap: 4, flex: '1 1 320px' }}>
            <b style={{ fontSize: 17 }}>{r.inventaire_le ? `Dernier inventaire ${ilYA(r.inventaire_le)}` : 'Faites votre premier inventaire'}</b>
            <span className="petit">Comptez vos bouteilles pour garder votre stock à jour : alertes de stock bas et commandes au plus juste.</span>
          </div>
          <Link href={`/admin/${r.id}/inventaire`} className="btn">Faire l’inventaire</Link>
        </section>
      )}

      {/* La règle de Pat du jour : une de ses règles, illustrée par le meilleur vin de la carte pour un plat du menu. */}
      {!miseEnRoute && jour && vin && (
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
