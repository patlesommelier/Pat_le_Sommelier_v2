import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ilYA, inventaireARefaire } from '@/lib/admin/inventaire';
import { BienvenueRestaurant } from '@/components/admin/BienvenueRestaurant';
import { aVerifierLecture, getRestaurantBO, getResume } from '@/lib/admin/donnees';
import { caveVisible, prochaineEtape } from '@/lib/admin/prochaine-etape';
import { AccueilResto } from '@/components/admin/AccueilResto';
import { commandesAVoir, stockBas } from '@/lib/admin/stocks';
import { getVinsBO, type RestaurantBO, type Resume } from '@/lib/admin/donnees';
import { regrouperVins } from './carte/etats';
import { exigerAcces, prenomUtilisateur } from '@/lib/admin/auth';

/** Page d'accueil du restaurant (Home) : bonjour, la prochaine étape, Pat le sommelier et Quid Vinum avec leurs chiffres, l'app et le QR code. */
export default async function TableauDeBord({ params, searchParams }: { params: Promise<{ resto: string }>; searchParams: Promise<{ bienvenue?: string }> }) {
  const { resto } = await params;
  const { bienvenue } = await searchParams;
  const aujourdhui = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
  const u = await exigerAcces(resto); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const [r, s, prenom] = await Promise.all([getRestaurantBO(resto), getResume(resto), prenomUtilisateur(u, resto)]);
  if (!r) notFound();
  // Après l'inscription : « Bienvenue », préparation des accords et QR code, à la place du résumé.
  const accueil = Boolean(bienvenue) || (r.origine === 'inscription' && r.statut === 'mise_en_place');
  // Restaurant inscrit seul, avant son premier client : ses premiers pas sont guidés par les post-it du menu ; pas de
  // « Votre prochaine étape » ici en plus.
  const miseEnRoute = !accueil && r.origine === 'inscription' && !r.premier_client_le;
  // « Votre prochaine étape » : ni pendant la mise en route (ses 3 pas guident déjà), ni avec l'annonce de la cave.
  const etape = !accueil && !miseEnRoute ? await etapeDuRestaurant(r, s, u.admin) : null;
  return (
    <>
      {accueil ? <BienvenueRestaurant restaurantId={r.id} /> : (
        <AccueilResto resto={r.id} cave={caveVisible(r)}
          entete={<header className="ha-bonjour"><span>{aujourdhui}</span><h1>{prenom ? `Bonjour ${prenom}` : 'Bonjour'}</h1></header>}
          etape={etape && (
            <section className="ha-etape" aria-label="Votre prochaine étape">
              <span className="surtitre">Votre prochaine étape</span>
              <span><b>{etape.titre}</b> <span className="discret">{etape.texte}</span></span>
              <Link href={`/admin/${r.id}${etape.chemin}`} className="btn petit">{etape.bouton} →</Link>
            </section>
          )} />
      )}
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
