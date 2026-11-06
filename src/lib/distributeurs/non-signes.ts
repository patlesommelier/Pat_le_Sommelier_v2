import 'server-only';
// Distributeurs propres aux restaurants (« Mes distributeurs »), pas encore distributeurs Quid Vinum : leurs commandes partent
// directement chez eux par e-mail, sans commission. Le super-admin les voit regroupés par nom (tous restaurants confondus), avec
// les commandes qu'ils ont reçues via Quid Vinum (l'argument pour les faire signer), et peut les faire passer en distributeur QV.
import { randomUUID } from 'node:crypto';
import { requete } from '../db';
import { associerAuCatalogue } from '../admin/distributeur-vin';
import { cleDistributeur } from './cle-distributeur';

export { cleDistributeur };


export interface DistributeurNonSigne {
  cle: string; nom: string; emails: string[]; restaurants: { id: string; nom: string }[];
  commandes: number; commandes90: number; bouteilles: number; derniere: string | null;
}

/** Distributeurs des restaurants pas encore chez Quid Vinum, regroupés par nom, les plus commandés d'abord. */
export async function distributeursNonSignes(): Promise<DistributeurNonSigne[]> {
  const lignes = await requete<{ id: string; nom: string; email: string | null; restaurant_id: string; restaurant: string;
    commandes: number; commandes90: number; bouteilles: number; derniere: string | null }>(
    `select f.id, f.nom, nullif(lower(trim(f.email)), '') as email, r.id as restaurant_id, r.nom as restaurant,
            count(distinct c.id)::int as commandes,
            count(distinct c.id) filter (where c.envoyee_le > now() - interval '90 days')::int as commandes90,
            coalesce((select sum(l.quantite) from commande_ligne l join commande cc on cc.id = l.commande_id
                       where cc.fournisseur_id = f.id and cc.envoyee_le is not null and cc.statut <> 'annulee'), 0)::int as bouteilles,
            max(c.envoyee_le)::text as derniere
       from fournisseur f join restaurant r on r.id = f.restaurant_id
       left join commande c on c.fournisseur_id = f.id and c.envoyee_le is not null and c.statut <> 'annulee'
      where f.distributeur_id is null
      group by f.id, r.id`);
  const groupes = new Map<string, DistributeurNonSigne & { noms: Map<string, number> }>();
  for (const l of lignes) {
    const cle = cleDistributeur(l.nom);
    if (!cle) continue;
    const g = groupes.get(cle) ?? { cle, nom: l.nom, emails: [] as string[], restaurants: [] as { id: string; nom: string }[], commandes: 0, commandes90: 0, bouteilles: 0, derniere: null, noms: new Map() };
    g.noms.set(l.nom, (g.noms.get(l.nom) ?? 0) + 1);
    if (l.email && !g.emails.includes(l.email)) g.emails.push(l.email);
    if (!g.restaurants.some((r) => r.id === l.restaurant_id)) g.restaurants.push({ id: l.restaurant_id, nom: l.restaurant });
    g.commandes += l.commandes; g.commandes90 += l.commandes90; g.bouteilles += l.bouteilles;
    if (l.derniere && (!g.derniere || l.derniere > g.derniere)) g.derniere = l.derniere;
    groupes.set(cle, g);
  }
  return [...groupes.values()].map(({ noms, ...g }) => ({ ...g, nom: [...noms.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.commandes - a.commandes || a.nom.localeCompare(b.nom));
}

/**
 * Passe un distributeur des restaurants en distributeur Quid Vinum, chez tous ses restaurants d'un coup : un nouveau distributeur
 * QV (coordonnées reprises) ou un existant. Chaque restaurant garde ses vins chez lui ; ses prochaines commandes passent par
 * Quid Vinum ; ses vins sont reliés au catalogue s'il y en a un ; un avis le prévient. Les commandes passées ne changent pas.
 * Un restaurant verrouillé sur un autre distributeur QV garde son distributeur tel quel (compté dans `ignores`).
 */
export async function passerEnDistributeurQv(cle: string, cible: string | null) {
  const fournisseurs = (await requete<{ id: string; restaurant_id: string; nom: string; email: string | null; adresse: string | null; tva: string | null;
    contact: string | null; telephone: string | null; verrou: string | null }>(
    `select f.id, f.restaurant_id, f.nom, f.email, f.adresse, f.tva, f.contact, f.telephone, r.distributeur_qv_unique as verrou
       from fournisseur f join restaurant r on r.id = f.restaurant_id where f.distributeur_id is null order by f.cree_le`))
    .filter((f) => cleDistributeur(f.nom) === cle);
  if (!fournisseurs.length) return null;
  let id = cible;
  if (!id) {
    // Nouveau distributeur QV, avec les coordonnées connues des restaurants (la plus renseignée d'abord).
    const ref = [...fournisseurs].sort((a, b) => [b.email, b.adresse, b.tva, b.telephone].filter(Boolean).length - [a.email, a.adresse, a.tva, a.telephone].filter(Boolean).length)[0];
    const [existant] = await requete<{ id: string }>('select id from distributeur where lower(nom) = lower($1)', [ref.nom]);
    id = existant?.id ?? randomUUID();
    if (!existant) await requete(`insert into distributeur (id, nom, email, adresse, tva, contact, telephone) values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, ref.nom, ref.email, ref.adresse, ref.tva, ref.contact, ref.telephone]);
  }
  const [d] = await requete<{ id: string; nom: string }>('select id, nom from distributeur where id = $1', [id]);
  if (!d) return null;
  const restos: string[] = [];
  let ignores = 0;
  for (const f of fournisseurs) {
    if (f.verrou && f.verrou !== d.id) { ignores++; continue; }
    // Le restaurant avait déjà ce distributeur QV : ses vins et ses commandes y passent, le doublon est retiré.
    const [deja] = await requete<{ id: string }>('select id from fournisseur where restaurant_id = $1 and distributeur_id = $2', [f.restaurant_id, d.id]);
    let fid = f.id;
    if (deja) {
      await requete('update vin_carte set fournisseur_id = $2 where fournisseur_id = $1', [f.id, deja.id]);
      await requete('update commande set fournisseur_id = $2 where fournisseur_id = $1', [f.id, deja.id]);
      await requete('delete from fournisseur where id = $1', [f.id]);
      fid = deja.id;
    } else {
      await requete('update fournisseur set distributeur_id = $2, nom = $3 where id = $1', [f.id, d.id, d.nom]);
    }
    // Vins du restaurant chez ce distributeur : reliés à son catalogue quand il y en a un (prix public moins la remise).
    const vins = await requete<{ id: string }>('select id from vin_carte where restaurant_id = $1 and fournisseur_id = $2', [f.restaurant_id, fid]);
    for (const v of vins) await associerAuCatalogue(f.restaurant_id, [v.id], fid);
    if (!restos.includes(f.restaurant_id)) {
      restos.push(f.restaurant_id);
      await requete(`insert into avis_restaurant (restaurant_id, titre, texte, lien) values ($1, $2, $3, $4)`,
        [f.restaurant_id, `${d.nom} est désormais distributeur Quid Vinum`,
          `Vos prochaines commandes chez ${d.nom} passent par Quid Vinum, au même prix qu’en direct (le prix public moins votre remise). `
          + 'Vos vins restent chez lui ; les commandes déjà passées ne changent pas.', `/admin/${f.restaurant_id}/fournisseurs`]);
    }
  }
  return { id: d.id, nom: d.nom, restaurants: restos.length, ignores };
}
