import type { EtatEtape } from '@/components/admin/Nav';
import { reglagesModifies, type RestaurantBO, type Resume } from '@/lib/admin/donnees';

export interface EtapeDetail { href: string; libelle: string; icone: string; etat: EtatEtape; ligne1: string; ligne2: string; statut: [string, 'ok' | 'propose' | 'attention' | 'defaut' | '']; action: string }

const pl = (n: number, s: string, p = `${s}s`) => `${n.toLocaleString('fr-BE')} ${n > 1 ? p : s}`;

/** Les sept étapes de la mise en place, avec leur état calculé depuis la base. */
export function etapesRestaurant(r: RestaurantBO, s: Resume): EtapeDetail[] {
  const base = `/admin/${r.id}`;
  const accordsFaits = s.accords > 0 && s.accords_proposes === 0;
  const modifs = reglagesModifies(r).length;
  return [
    { href: `${base}/menu`, libelle: 'Menu', icone: 'menu', etat: s.plats ? 'fait' : 'encours',
      ligne1: pl(s.plats, 'plat proposé', 'plats proposés'), ligne2: s.plats_inactifs ? `${pl(s.plats_inactifs, 'plat masqué', 'plats masqués')} aux clients` : 'Noms, prix et catégories modifiables',
      statut: s.plats ? ['Fait', 'ok'] : ['À faire', ''], action: 'Gérer le menu' },
    { href: `${base}/carte`, libelle: 'Carte des vins', icone: 'bottle', etat: s.vins ? 'fait' : 'afaire',
      ligne1: `${pl(s.vins, 'référence')} · ${pl(s.vins_etiquette, 'étiquette')}`,
      ligne2: s.nouveaux_producteurs ? `${pl(s.nouveaux_producteurs, 'nouveau producteur proposé', 'nouveaux producteurs proposés')} à la base de Pat` : `${pl(s.vins_producteur, 'vin relié', 'vins reliés')} à un producteur de Pat`,
      statut: s.vins ? ['Fait', 'ok'] : ['À faire', ''], action: 'Gérer la carte' },
    { href: `${base}/accords`, libelle: 'Accords', icone: 'link', etat: s.preparation_en_cours ? 'encours' : accordsFaits ? 'fait' : s.vins && s.plats ? 'encours' : 'afaire',
      ligne1: s.accords ? `${pl(s.accords, 'accord')} sur ${pl(s.plats_avec_accords, 'plat')}` : 'À générer',
      ligne2: s.preparation_en_cours ? `Pat prépare vos accords : ${s.plats_avec_accords} plat(s) sur ${s.plats}`
        : s.accords ? `${pl(s.accords_valides, 'validé', 'validés')} · ${pl(s.accords_proposes, 'à relire', 'à relire')}` : 'Pat note chaque vin sur chaque plat, de 1 à 5',
      statut: s.preparation_en_cours ? ['En cours', 'propose'] : accordsFaits ? ['Validés', 'ok'] : s.accords ? ['À relire', 'propose'] : ['Étape suivante', 'propose'],
      action: s.accords ? 'Relire les accords' : 'Voir les accords' },
    // Les règles de Pat par défaut suffisent pour servir : l'étape est faite même sans réglage modifié.
    { href: `${base}/regles`, libelle: 'Règles du sommelier', icone: 'sliders', etat: 'fait',
      ligne1: modifs ? pl(modifs, 'réglage modifié', 'réglages modifiés') : 'Règles de Pat par défaut (V7)', ligne2: 'À ajuster selon votre service',
      statut: modifs ? ['Ajustées', 'ok'] : ['Par défaut', 'ok'], action: 'Voir les règles' },
    { href: `${base}/apparence`, libelle: 'Apparence', icone: 'palette', etat: r.modifie_bo ? 'fait' : 'afaire',
      ligne1: `Logo et couleur de ${r.nom}`, ligne2: 'La couleur peut venir d’une photo de votre salle',
      statut: r.modifie_bo ? ['Fait', 'ok'] : ['À faire', ''], action: 'Choisir l’apparence' },
    { href: `${base}/acces`, libelle: 'Accès & QR code', icone: 'qr', etat: s.acces ? 'fait' : 'afaire',
      ligne1: s.acces ? pl(s.acces, 'accès créé', 'accès créés') : 'Accès à créer', ligne2: 'Pour retrouver vos accords et imprimer votre QR code',
      statut: s.acces ? ['Fait', 'ok'] : ['À faire', ''], action: s.acces ? 'Voir le QR code' : 'Créer un accès' },
    { href: `${base}/simulateur`, libelle: 'Simulateur', icone: 'phone', etat: 'afaire',
      ligne1: 'Testez Pat comme un client', ligne2: s.accords ? 'Les vins proposés pour chaque plat, et pourquoi' : 'Disponible dès que les accords sont générés',
      statut: ['Toujours disponible', ''], action: 'Ouvrir le simulateur' },
  ];
}
