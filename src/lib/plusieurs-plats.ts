// Plusieurs plats à la même table : Pat choisit les vins en suivant ses principes « plusieurs plats »
// (partir du plat le plus fragile, chercher un point d'ancrage commun…), parmi les vins notés au-dessus du seuil sur tous les plats.
// Le choix et l'explication d'ensemble sont gardés (accord_table) : un seul appel par combinaison de plats.
// Côté serveur uniquement : les rankings sont donnés à Pat pour départager, jamais montrés.
import 'server-only';
import { createHash } from 'node:crypto';
import { clientClaude, modeleAccords } from './claude';
import { requete } from './db';

export interface ChoixTable { vin_id: string; explication: string }

const SANS_ACCENTS = (x: string) => `translate(lower(${x}), 'àâäáéèêëíîïóôöúùûüç', 'aaaaeeeeiiiooouuuuc')`;

/** Principes validés de Pat sur les accords pour plusieurs plats (titre, règle ou étiquettes). */
export async function principesPlusieursPlats() {
  return requete<{ numero: number; titre: string; regle: string }>(
    `select numero, titre, regle from principe
      where statut = 'valide' and ${SANS_ACCENTS("titre || ' ' || regle || ' ' || array_to_string(tags, ' ')")} like '%plusieurs plats%'
      order by numero`);
}

type Candidat = {
  id: string; libelle: string; couleur: string; cepages: string | null; appellation: string | null; prix: number | null;
  ranking_producteur: number | null; notes: Record<string, number>;
};
type PlatTable = { id: string; nom: string; description: string | null };
type Ligne = { plat_id: string; vin_id: string; explication: string | null };

/**
 * Vins proposés pour ces plats, du meilleur au moins bon, avec une explication d'ensemble (null : pas de principe, ou échec).
 * `candidats` : vins déjà filtrés (note au-dessus du seuil sur chaque plat), dans l'ordre des règles de sélection.
 */
export async function choisirPourPlusieursPlats(restaurantId: string, plats: PlatTable[], candidats: Candidat[], lignes: Ligne[]): Promise<ChoixTable[] | null> {
  if (plats.length < 2 || !candidats.length) return null;
  const principes = await principesPlusieursPlats();
  if (!principes.length) return null;
  const liste = candidats.slice(0, 12);
  const cle = createHash('sha256').update(JSON.stringify({
    plats: plats.map((p) => [p.id, p.nom, p.description]).sort(),
    vins: liste.map((v) => [v.id, v.libelle, v.notes, v.ranking_producteur]),
    principes: principes.map((p) => [p.numero, p.regle]),
  })).digest('hex');
  const [deja] = await requete<{ resultat: ChoixTable[] }>('select resultat from accord_table where restaurant_id = $1 and cle = $2', [restaurantId, cle]);
  if (deja) return deja.resultat;

  const nomPlat = new Map(plats.map((p) => [p.id, p.nom]));
  const pourquoi = (vin: string, plat: string) => lignes.find((l) => l.vin_id === vin && l.plat_id === plat)?.explication ?? '';
  const consigne = `Tu es Pat, sommelier. Des clients partagent une bouteille pour plusieurs plats à la même table.
Applique tes principes pour les accords de plusieurs plats :
${principes.map((p) => `- ${p.titre} : ${p.regle}`).join('\n')}

Plats choisis :
${plats.map((p) => `- ${p.nom}${p.description ? ` (${p.description})` : ''}`).join('\n')}

Vins candidats (tous notés au moins 3/5 sur chaque plat), avec leur note et l'accord avec chaque plat :
${liste.map((v) => `[${v.id}] ${v.libelle} · ${v.couleur}${v.cepages ? ` · ${v.cepages}` : ''}${v.appellation ? ` · ${v.appellation}` : ''}${v.prix ? ` · ${v.prix} €` : ''}${v.ranking_producteur != null ? ` · producteur ${v.ranking_producteur}/5` : ''}
${plats.map((p) => `    ${nomPlat.get(p.id)} : ${v.notes[p.id]}/5 — ${pourquoi(v.id, p.id)}`).join('\n')}`).join('\n')}

Classe ces vins du meilleur au moins bon pour l'ensemble de la table (9 au plus ; écarte ceux qui se brisent sur un plat).
Pour chacun, écris en 2 phrases au plus, au client, pourquoi il tient tous ces plats (le plat le plus fragile, le point d'ancrage commun).
Ne parle jamais de notes, de score ni de classement des producteurs. Pas de contenant (bouteille, verre).
Réponds uniquement en JSON, sans texte autour : [{"vin": "identifiant", "pourquoi": "..."}]`;
  try {
    const m = await clientClaude({ maxRetries: 2 }).messages.create({ model: modeleAccords(), max_tokens: 2500, messages: [{ role: 'user', content: consigne }] });
    const texte = m.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const brut = JSON.parse(texte.slice(texte.indexOf('['), texte.lastIndexOf(']') + 1)) as { vin?: unknown; pourquoi?: unknown }[];
    const ids = new Set(liste.map((v) => v.id));
    const resultat: ChoixTable[] = [];
    for (const x of brut) {
      if (typeof x.vin !== 'string' || !ids.has(x.vin) || resultat.some((r) => r.vin_id === x.vin)) continue;
      resultat.push({ vin_id: x.vin, explication: typeof x.pourquoi === 'string' ? x.pourquoi.trim() : '' });
    }
    if (!resultat.length) return null;
    await requete(`insert into accord_table (restaurant_id, cle, resultat) values ($1, $2, $3) on conflict (restaurant_id, cle) do update set resultat = excluded.resultat, cree_le = now()`,
      [restaurantId, cle, JSON.stringify(resultat)]);
    return resultat;
  } catch (e) {
    console.error('[plusieurs plats]', restaurantId, e);
    return null;
  }
}
