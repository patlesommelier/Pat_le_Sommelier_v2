import 'server-only';
// E-mails de relance de la mise en route : un restaurant inscrit seul dont aucun client n'a encore utilisé l'app reçoit
// un e-mail le lendemain de son passage au vert (actif : vins validés par Quid Vinum), puis un second 3 jours après.
// Chacun part une seule fois, et seulement dans les 14 jours qui suivent ce passage au vert.
import { requete } from '../db';
import { adressePour } from '../domaines';
import { envoiEmailConfigure, envoyerEmail } from '../email';

import { texteRelance, type Relance } from './relances-texte';

/** Envoie les relances dues ; renvoie le nombre d'e-mails partis. Sans envoi d'e-mails configuré, ne fait rien. */
export async function envoyerRelances(): Promise<number> {
  if (!envoiEmailConfigure()) return 0;
  const base = adressePour('/admin');
  if (!base) return 0; // pas d'adresse fixe du site pour le lien : rien plutôt qu'un lien faux
  let partis = 0;
  for (const numero of [1, 2] as const) {
    const [colonne, delai] = numero === 1 ? ['relance_1_le', '1 day'] : ['relance_2_le', '3 days'];
    // Réservées d'abord (une seule instance du serveur les envoie), puis envoyées.
    const dues = await requete<Relance>(
      `update restaurant r set ${colonne} = now()
        where r.origine = 'inscription' and r.premier_client_le is null and r.statut <> 'suspendu' and r.mode = 'actif' and r.${colonne} is null
          and r.actif_le < now() - interval '${delai}' and r.actif_le > now() - interval '14 days'
          ${numero === 2 ? 'and r.relance_1_le is not null' : ''}
       returning r.id, r.nom, r.statut::text,
         coalesce(r.cree_par, (select a.email from acces_restaurant a where a.restaurant_id = r.id order by a.email limit 1)) as email,
         (select a.prenom from acces_restaurant a where a.restaurant_id = r.id and a.prenom is not null limit 1) as prenom,
         ((select count(*) from vin_carte v where v.restaurant_id = r.id and v.disponible and v.prix is null and v.prix_verre is null)
          + (select count(*) from plat p where p.restaurant_id = r.id and p.actif and p.prix is null and coalesce(p.prix_variantes, '') = ''))::int as sans_prix`);
    for (const r of dues) {
      if (!r.email) continue;
      const { sujet, texte } = texteRelance(r, numero, `${base}/admin/${r.id}`);
      const erreur = await envoyerEmail({ a: r.email, sujet, texte });
      if (erreur) {
        console.error(`[relances] ${r.id} relance ${numero} : ${erreur}`);
        await requete(`update restaurant set ${colonne} = null where id = $1`, [r.id]); // réessayée au prochain passage
      } else partis++;
    }
  }
  return partis;
}
