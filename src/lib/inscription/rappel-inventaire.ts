import 'server-only';
// Rappels d'inventaire du lundi matin : un e-mail aux utilisateurs de chaque restaurant qui a choisi une fréquence
// (Paramètres du restaurant), cave ouverte. Réservés d'abord (une seule instance du serveur les envoie), puis envoyés.
import { requete } from '../db';
import { adressePour } from '../domaines';
import { envoiEmailConfigure, envoyerEmail } from '../email';
import { rappelDu, texteRappelInventaire, type Frequence } from './rappel-inventaire-texte';

export async function envoyerRappelsInventaire(maintenant = new Date()): Promise<number> {
  if (!envoiEmailConfigure()) return 0;
  const base = adressePour('/admin');
  if (!base) return 0;
  const candidats = await requete<{ id: string; nom: string; frequence: Frequence; rappel: string | null }>(
    `select id, nom, inventaire_frequence as frequence, inventaire_rappel_le::text as rappel from restaurant
      where inventaire_frequence <> 'aucune' and statut <> 'suspendu'
        and mode = 'actif' -- en vert : seul statut où les e-mails partent
        and (inventaire_le is null or inventaire_le < now() - interval '1 day')`); // pas s'il vient d'être fait
  let partis = 0;
  for (const r of candidats) {
    if (!rappelDu(r.frequence, maintenant, r.rappel ? new Date(r.rappel) : null)) continue;
    const [pris] = await requete<{ id: string }>(
      `update restaurant set inventaire_rappel_le = $3 where id = $1 and inventaire_rappel_le is not distinct from $2::timestamptz returning id`, [r.id, r.rappel, maintenant]);
    if (!pris) continue; // une autre instance s'en occupe
    let comptes = await requete<{ email: string; prenom: string | null }>(
      'select distinct on (lower(email)) email, prenom from acces_restaurant where restaurant_id = $1 and email is not null', [r.id]);
    if (!comptes.length) comptes = await requete<{ email: string; prenom: string | null }>(
      'select cree_par as email, null as prenom from restaurant where id = $1 and cree_par is not null', [r.id]);
    const avant = partis;
    for (const c of comptes) {
      const { sujet, texte } = texteRappelInventaire(r.nom, c.prenom, `${base}/admin/${r.id}/inventaire`);
      const erreur = await envoyerEmail({ a: c.email, sujet, texte });
      if (erreur) console.error(`[inventaire] rappel ${r.id} → ${c.email} : ${erreur}`); else partis++;
    }
    if (comptes.length && partis === avant) // rien n'est parti : réessayé au prochain passage
      await requete('update restaurant set inventaire_rappel_le = $2::timestamptz where id = $1', [r.id, r.rappel]);
  }
  return partis;
}
