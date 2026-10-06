// Finalisation : l'e-mail est confirmé, le restaurant est créé et Pat commence à préparer les accords.
// Idempotente : peut être rappelée sans créer de doublon (lien de confirmation ouvert deux fois).
import 'server-only';
import { requete } from '../db';
import { partagerEtiquettes } from '../etiquettes/partage';
import { chercherEtiquettesManquantes } from '../etiquettes/lancer';
import { deposerImage } from '../admin/fichiers';
import { creerVinsEnAttente, preparerAccords } from './adaptateurs';
import { lireInscription, majInscription } from './etat';
import { slugRestaurant } from './slug';

/** Fond clair de la barre Pat : la couleur du restaurant mêlée de blanc. */
function couleurClaire(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const m = (c: number) => Math.round(c + (255 - c) * 0.94).toString(16).padStart(2, '0');
  return `#${m((n >> 16) & 255)}${m((n >> 8) & 255)}${m(n & 255)}`.toUpperCase();
}

const LETTRE: Record<string, string> = { bulles: 'E', blanc: 'B', rose: 'P', orange: 'O', rouge: 'R', doux: 'D' };
const slugPlat = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

/** Finalisation déjà en cours ailleurs (lien de l'e-mail, écran d'attente d'un autre appareil, connexion). */
export class FinalisationEnCours extends Error {}

export async function finaliserInscription(inscriptionId: string, userId: string, email: string,
  { attendre = true }: { attendre?: boolean } = {}): Promise<{ restaurantId: string }> {
  const i0 = await lireInscription(inscriptionId);
  if (!i0) throw new Error('Inscription introuvable.');
  if (i0.user_id !== userId) throw new Error('Cette inscription appartient à un autre compte.');
  if (i0.statut === 'finalisee' && i0.restaurant_id) return { restaurantId: i0.restaurant_id };

  // Un seul appel à la fois : les autres attendent qu'il ait fini (ou abandonnent, pour l'écran d'attente).
  const [verrou] = await requete(
    `update inscription set finalisation_le = now() where id = $1 and statut <> 'finalisee'
        and (finalisation_le is null or finalisation_le < now() - interval '3 minutes') returning id`, [inscriptionId]);
  if (!verrou) {
    for (let n = 0; attendre && n < 25; n++) {
      await new Promise((r) => setTimeout(r, 1000));
      const j = await lireInscription(inscriptionId);
      if (j?.statut === 'finalisee' && j.restaurant_id) return { restaurantId: j.restaurant_id };
    }
    throw new FinalisationEnCours('Finalisation déjà en cours.');
  }
  try {
    return await finaliser(inscriptionId, userId, email);
  } finally {
    await requete('update inscription set finalisation_le = null where id = $1', [inscriptionId]);
  }
}

async function finaliser(inscriptionId: string, userId: string, email: string): Promise<{ restaurantId: string }> {
  const i = (await lireInscription(inscriptionId))!;
  if (i.statut === 'finalisee' && i.restaurant_id) return { restaurantId: i.restaurant_id };

  // 1. Restaurant — créé une seule fois ; son id est noté tout de suite pour qu'une reprise le réutilise.
  let restaurantId = i.restaurant_id;
  if (!restaurantId) {
    const existants = new Set((await requete<{ id: string }>('select id from restaurant')).map((r) => r.id));
    restaurantId = slugRestaurant(i.nom_restaurant ?? 'restaurant', existants);
    const couleur = i.couleur ?? '#610420';
    await requete(
      `insert into restaurant (id, nom, couleur, couleur_claire, accroche, statut, ville, origine, cree_par)
       values ($1, $2, $3, $4, $5, 'mise_en_place', $6, 'inscription', $7)`,
      [restaurantId, i.nom_restaurant, couleur, couleurClaire(couleur), `Bienvenue chez ${i.nom_restaurant},|nous vous aidons à choisir votre vin`, i.ville, email]);
    await majInscription(inscriptionId, { restaurant_id: restaurantId });
  } else {
    // Reprise après une erreur : on repart d'une carte et d'un menu vides pour ne rien dupliquer.
    await requete('delete from plat where restaurant_id = $1', [restaurantId]);
    await requete('delete from vin_carte where restaurant_id = $1', [restaurantId]);
  }

  // 2. Accès du compte à son restaurant (lu par exigerAcces).
  await requete(`insert into acces_restaurant (user_id, email, restaurant_id) values ($1, $2, $3) on conflict do nothing`, [userId, email, restaurantId]);

  // 3. Logo : déposé dans le stockage public des médias, comme depuis l'écran Apparence.
  if (i.logo_fichier) {
    const [f] = await requete<{ nom: string; media_type: string; octets: Buffer }>('select nom, media_type, octets from inscription_fichier where id = $1', [i.logo_fichier]);
    if (f) {
      try {
        const url = await deposerImage(new File([new Uint8Array(f.octets)], f.nom, { type: f.media_type }), `restaurants/${restaurantId}`);
        await requete('update restaurant set logo_url = $2 where id = $1', [restaurantId, url]);
      } catch (e) {
        console.error('[inscription] logo', e); // le restaurant pourra le déposer depuis Apparence
      }
    }
  }

  // 4. Plats (sauce_servie_a_part reste vide : le restaurant la renseignera dans son espace).
  const ids = new Set<string>();
  for (const [k, p] of i.plats.entries()) {
    let id = `${restaurantId}-${slugPlat(p.nom) || 'plat'}`;
    for (let n = 2; ids.has(id); n++) id = `${restaurantId}-${slugPlat(p.nom) || 'plat'}-${n}`;
    ids.add(id);
    await requete(
      `insert into plat (id, restaurant_id, nom, categorie, description_cuisine, ordre, actif) values ($1, $2, $3, $4::categorie_plat, $5, $6, true)`,
      [id, restaurantId, p.nom, p.categorie, p.description, k + 1]);
  }

  // 5. Vins : producteurs inconnus proposés à Pat, puis la carte (ranking 0 tant que Pat n'a pas validé).
  const producteurs = await creerVinsEnAttente(restaurantId, i.vins);
  const compteurs: Record<string, number> = {};
  for (const [k, v] of i.vins.entries()) {
    const l = LETTRE[v.couleur] ?? 'X';
    compteurs[l] = (compteurs[l] ?? 0) + 1;
    const id = `${restaurantId}-${l}${String(compteurs[l]).padStart(2, '0')}`;
    await requete(
      `insert into vin_carte (id, restaurant_id, couleur, section, libelle, producteur_id, producteur_texte, vin_texte, millesime, format,
                              prix, prix_verre, ordre, disponible)
       values ($1, $2, $3::couleur_vin, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)`,
      [id, restaurantId, v.couleur, v.region, v.libelleCarte, producteurs[k], v.producteur, v.appellation, v.millesime,
        v.auVerre ? 'au verre' : v.contenance ?? '75 cl', v.auVerre ? null : v.prix, v.auVerre ? v.prix ?? v.prixVerre : v.prixVerre, k + 1]);
  }

  // Étiquettes déjà connues de la base de Pat (au niveau de la cuvée).
  await partagerEtiquettes(requete, { vins: (await requete<{ id: string }>('select id from vin_carte where restaurant_id = $1', [restaurantId])).map((v) => v.id) })
    .catch((e) => console.error('[inscription] étiquettes', e));
  // Étiquettes encore manquantes : demandées à Wine Labs (une par cuvée), en arrière-plan.
  await chercherEtiquettesManquantes(restaurantId).catch((e) => console.error('[inscription] Wine Labs', e));

  await majInscription(inscriptionId, { statut: 'finalisee' });

  // 6. Préparation des accords en arrière-plan (fonctions Netlify, jusqu'à 15 minutes chacune).
  await preparerAccords(restaurantId, email);
  return { restaurantId };
}
