import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ilYA, inventaireARefaire } from '@/lib/admin/inventaire';
import { BienvenueRestaurant } from '@/components/admin/BienvenueRestaurant';
import { Entete } from '@/components/admin/Ui';
import { aVerifierLecture, getRegleDuJour, getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { caveVisible, prochaineEtape } from '@/lib/admin/prochaine-etape';
import { Chiffres, Nouvelles, Raccourcis } from '@/components/admin/ChiffresRestaurant';
import { commandesAVoir, stockBas } from '@/lib/admin/stocks';
import { getVinsBO, type RestaurantBO, type Resume } from '@/lib/admin/donnees';
import { regrouperVins } from './carte/etats';
import { exigerAcces, prenomUtilisateur } from '@/lib/admin/auth';
import { titreCarte } from '@/lib/admin/intitule';
import { avecAppreciation } from '@/lib/appreciation';

/** Tableau de bord : bonjour, l'espace Quid Vinum (et Pat le Sommelier pour les accords), le résumé du restaurant et la règle de Pat du jour. */
export default async function TableauDeBord({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ bienvenue?: string }> }) {
  const { resto } = await params;
  const { bienvenue } = await searchParams;
  const aujourdhui = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
  const u = await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const [r, s, prenom, jour] = await Promise.all([getRestaurantBO(resto), getResume(resto), prenomUtilisateur(u, resto), getRegleDuJour(resto)]);
  if (!r) notFound();
  // Après l'inscription : « Bienvenue », préparation des accords et QR code, à la place du résumé.
  const accueil = Boolean(bienvenue) || (r.origine === 'inscription' && r.statut === 'mise_en_place');
  // Restaurant inscrit seul, avant son premier client : ses premiers pas sont guidés par les post-it du menu ; pas de
  // « Votre prochaine étape » ici en plus.
  const miseEnRoute = !accueil && r.origine === 'inscription' && !r.premier_client_le;
  // « Votre prochaine étape » : ni pendant la mise en route (ses 3 pas guident déjà), ni avec l'annonce de la cave.
  const etape = !accueil && !miseEnRoute ? await etapeDuRestaurant(r, s, u.admin) : null;
  const vin = jour && titreCarte(jour.vin);
  return (
    <>
      {accueil ? <BienvenueRestaurant restaurantId={r.id} /> : <div className="rac rac-a">
        {/* En haut : bonjour, la date, et la prochaine étape conseillée comme action principale. */}
        <section className="rac-hero" aria-labelledby="bonjour">
          <div className="pile" style={{ gap: 10, flex: '1 1 380px' }}>
            <span className="rac-date">{aujourdhui}</span>
            <h1 id="bonjour">{prenom ? `Bonjour ${prenom}` : 'Bonjour'}</h1>
            {etape ? (
              <div className="rac-etape">
                <span className="rac-etape-sur">Votre prochaine étape</span>
                <b>{etape.titre}</b>
                <span>{etape.texte}</span>
                <span><Link href={`/admin/${r.id}${etape.chemin}`} className="btn rac-etape-btn">{etape.bouton} →</Link></span>
              </div>
            ) : <p className="rac-sous">Tout est à jour. Bon service !</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rac-pat" src="/pat/pat-attable-blanc.svg" alt="" width={240} height={188} />
        </section>
        <Raccourcis resto={r.id} cave={caveVisible(r)} />
        <Chiffres resto={r.id} cave={caveVisible(r)} />
        <div className="rac-deux">
          {/* La règle de Pat du jour : une de ses règles, illustrée par le meilleur vin de la carte pour un plat du menu. */}
          {jour && vin && (
            <section className="carte-bo rac-regle" aria-labelledby="regle-du-jour">
              <div className="rac-regle-tete">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/pat/pat-avatar.svg" alt="" width={52} height={52} />
                <div className="pile" style={{ gap: 2 }}>
                  <span className="surtitre" id="regle-du-jour">La règle de Pat du jour</span>
                  <h2 style={{ fontSize: 22, margin: 0 }}>{jour.titre}</h2>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55 }}>{jour.regle}</p>
              <div className="rac-regle-vin">
                {jour.vin.etiquette_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={jour.vin.etiquette_url} alt={`Étiquette : ${jour.vin.libelle}`} />
                )}
                <div className="pile" style={{ gap: 8, flex: '1 1 240px' }}>
                  <span className="surtitre">Avec : {jour.plat}</span>
                  <div>
                    <h3 style={{ fontSize: 19, margin: 0 }}>{vin.titre}</h3>
                    {vin.sousTitre && <span className="discret" style={{ fontSize: 14.5 }}>{vin.sousTitre}</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, paddingLeft: 12, borderLeft: '3px solid var(--rouge)' }}>
                    {avecAppreciation(jour.explication, jour.note, { cle: jour.plat_id, ecritParLeRestaurant: jour.ecrit_par_le_restaurant })}
                  </p>
                </div>
              </div>
            </section>
          )}
          <Nouvelles resto={r.id} cave={caveVisible(r)} />
        </div>
      </div>}
    </>
  );
}

/** Compteurs de « Votre prochaine étape » (le stock bas ne compte qu'après un premier inventaire). */
async function etapeDuRestaurant(r: RestaurantBO, s: Resume, admin: boolean) {
  const cave = caveVisible(r);
  const [aVoir, verifier, vins] = await Promise.all([admin ? 0 : commandesAVoir(r.id), aVerifierLecture(r.id),
    cave && r.inventaire_le ? getVinsBO(r.id) : []]);
  const vinsStockBas = regrouperVins(vins).filter((g) => g.tous.some((x) => x.disponible) && stockBas(g.principal.stock, r.stock_limite_basse ?? 2)).length;
  return prochaineEtape({
    commandesAVoir: aVoir, accordsARelire: s.accords_proposes, vinsSansPrix: verifier.vins.length, cave, vinsStockBas,
    inventaireARefaire: s.vins > 0 && inventaireARefaire(r.inventaire_le, r.inventaire_frequence), inventaireIlYA: r.inventaire_le ? ilYA(r.inventaire_le) : null,
    apparenceAChoisir: !r.modifie_bo,
  });
}
