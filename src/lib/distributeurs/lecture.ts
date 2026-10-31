// Lecture du tarif d'un distributeur (PDF) par Claude, quelques pages à la fois, puis enregistrement dans la base :
// un vin déjà connu (même clé) garde son prix imposé et son rattachement choisi par Pat ; un vin absent du tarif n'est plus proposé.
// Sans « server-only » : lancé en arrière-plan par le serveur.
import { randomUUID } from 'node:crypto';
import type { Requete } from '../generation/accords';
import { clientClaude, modeleLecture } from '../claude';
import { producteurConnu } from '../inscription/lecture';
import { cleVin, dedoublonner, vinTarif, type VinTarif } from './tarif';

const PAGES_PAR_LECTURE = 4;
const LECTURES_EN_PARALLELE = 3;
const PAGES_MAX = 80;
const FIN = 'PAS_DE_PAGE';

const consigne = (de: number, a: number) => `Ce document est le tarif d'un distributeur de vin (prix HTVA à la bouteille).
Relève UNIQUEMENT les vins des pages ${de} à ${a} du document (numérotation du fichier, la première page est la page 1).
Si le document n'a pas de page ${de}, réponds exactement ${FIN}, sans rien d'autre.
Pour chaque ligne de vin : « producteur » (domaine, château ou maison : le titre du domaine au-dessus des vins, ou le nom après le tiret
dans une liste ; sans le village ni la mention entre parenthèses — « Domaine Clotilde Davenne à Préhy (RAI) » donne « Domaine Clotilde Davenne » ;
null s'il n'est pas indiqué), « vin » (appellation et cuvée telles qu'écrites, sans millésime, sans contenance, sans le producteur),
« millesime » (4 chiffres, ou null), « contenance » (en cl, ex. « 37,5 cl », « 150 cl » ; null pour 75 cl),
« prix » (nombre, le prix de la ligne), « epuise » (true si la ligne dit épuisé), « max » (le nombre de « Max. N », ou null),
« couleur » parmi bulles, blanc, rose, rouge, doux, orange (selon le nom ou l'appellation ; null si impossible à savoir),
« certification » (BIO, BIODY, RAI… indiqué pour le domaine, ou null), « section » (le titre de région ou de liste au-dessus, ou null).
Les lignes qui ne sont pas des vins (conditions de vente, légende, coordonnées) sont ignorées. N'invente rien.
Réponds uniquement en JSON, sans texte autour : [{"producteur": "...", "vin": "...", "millesime": "2023", "contenance": null, "prix": 12.5,
"epuise": false, "max": null, "couleur": "blanc", "certification": "BIO", "section": "Bourgogne"}] ([] si ces pages n'ont aucun vin).`;

function tableau(t: string): unknown[] | null {
  const debut = t.indexOf('['), fin = t.lastIndexOf(']');
  if (debut < 0 || fin < debut) return null;
  try { const v = JSON.parse(t.slice(debut, fin + 1)); return Array.isArray(v) ? v : null; } catch { return null; }
}

/** Lit tout le tarif : quelques pages par appel (Claude est plus précis), jusqu'à la dernière page. */
export async function lireVinsDuTarif(pdf: Buffer): Promise<VinTarif[]> {
  const client = clientClaude({ maxRetries: 3 });
  // Le même document à chaque appel : gardé en cache chez Anthropic (moins cher dès le deuxième appel).
  const document = { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdf.toString('base64') },
    cache_control: { type: 'ephemeral' as const } };
  const lirePages = async (de: number): Promise<unknown[] | 'fin'> => {
    const m = await client.messages.stream({
      model: modeleLecture(), max_tokens: 32000,
      messages: [{ role: 'user', content: [document, { type: 'text', text: consigne(de, de + PAGES_PAR_LECTURE - 1) }] }],
    }).finalMessage();
    const t = m.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    if (t.includes(FIN) && !/\[\s*\{/.test(t)) return 'fin';
    const v = tableau(t);
    if (!v) throw new Error(`réponse illisible pour les pages ${de} à ${de + PAGES_PAR_LECTURE - 1}`);
    return v;
  };
  // Les premières pages seules d’abord : le document est mis en cache pour les lectures suivantes, faites en parallèle.
  const premiere = await lirePages(1);
  if (premiere === 'fin') return [];
  const bruts: unknown[] = [...premiere];
  for (let de = 1 + PAGES_PAR_LECTURE; de <= PAGES_MAX; de += PAGES_PAR_LECTURE * LECTURES_EN_PARALLELE) {
    const lots = await Promise.all(Array.from({ length: LECTURES_EN_PARALLELE }, (_, i) => lirePages(de + i * PAGES_PAR_LECTURE)));
    let fini = false;
    for (const l of lots) { if (l === 'fin') fini = true; else bruts.push(...l); }
    if (fini) break;
  }
  return dedoublonner(bruts.map(vinTarif).filter((v): v is VinTarif => v !== null));
}

/**
 * Enregistre les vins lus : nouveaux vins ajoutés, vins connus mis à jour (prix, disponibilité), vins absents du tarif
 * retirés de la proposition (gardés pour les anciennes commandes). Le producteur de la base de Pat est retrouvé par son nom,
 * sauf s'il a été choisi à la main. Renvoie les compteurs.
 */
export async function enregistrerVinsDuTarif(requete: Requete, distributeurId: string, vins: VinTarif[]) {
  const producteurs = new Map<string, string | null>();
  for (const nom of new Set(vins.map((v) => v.producteur).filter((p): p is string => Boolean(p)))) {
    producteurs.set(nom, (await producteurConnu(requete, nom))?.id ?? null);
  }
  const lignes = vins.map((v, i) => ({ ...v, cle: cleVin(v), ordre: i, producteur_id: v.producteur ? producteurs.get(v.producteur) ?? null : null }));
  const uniques = [...new Map(lignes.map((l) => [l.cle, l])).values()];
  const avant = new Set((await requete<{ cle: string }>('select cle from distributeur_vin where distributeur_id = $1 and actif', [distributeurId])).map((r) => r.cle));
  const col = <K extends keyof (typeof uniques)[number]>(k: K) => uniques.map((l) => l[k]);
  await requete(
    `insert into distributeur_vin (id, distributeur_id, cle, section, producteur_texte, libelle, millesime, contenance, couleur, certification,
                                   prix_qv, epuise, maximum, producteur_id, ordre)
     select x.id, $1, x.cle, x.section, x.producteur, x.libelle, x.millesime, x.contenance, x.couleur, x.certification, x.prix, x.epuise, x.maximum, x.producteur_id, x.ordre
       from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::numeric[], $12::bool[], $13::int[], $14::text[], $15::int[])
            as x(id, cle, section, producteur, libelle, millesime, contenance, couleur, certification, prix, epuise, maximum, producteur_id, ordre)
     on conflict (distributeur_id, cle) do update set section = excluded.section, producteur_texte = excluded.producteur_texte, libelle = excluded.libelle,
       millesime = excluded.millesime, contenance = excluded.contenance, couleur = coalesce(excluded.couleur, distributeur_vin.couleur),
       certification = excluded.certification, prix_qv = excluded.prix_qv, epuise = excluded.epuise, maximum = excluded.maximum, ordre = excluded.ordre,
       producteur_id = case when distributeur_vin.producteur_manuel then distributeur_vin.producteur_id else excluded.producteur_id end,
       actif = true, maj_le = now()`,
    [distributeurId, uniques.map(() => randomUUID()), col('cle'), col('section'), col('producteur'), col('libelle'), col('millesime'), col('contenance'),
      col('couleur'), col('certification'), col('prix'), col('epuise'), col('maximum'), col('producteur_id'), col('ordre')]);
  const retires = await requete<{ id: string }>(
    `update distributeur_vin set actif = false, maj_le = now() where distributeur_id = $1 and actif and not (cle = any($2)) returning id`,
    [distributeurId, col('cle')]);
  return { lus: uniques.length, nouveaux: uniques.filter((l) => !avant.has(l.cle)).length, retires: retires.length,
    rattaches: uniques.filter((l) => l.producteur_id).length };
}

/** Lecture complète du dernier tarif déposé, en arrière-plan : l'avancement est gardé sur le distributeur. */
export async function lireTarif(requete: Requete, distributeurId: string) {
  const etat = (statut: string, message: string) =>
    requete('update distributeur set lecture_statut = $2, lecture_message = $3, lecture_le = now() where id = $1', [distributeurId, statut, message]);
  try {
    const [t] = await requete<{ octets: Buffer; nom: string }>(
      'select octets, nom from distributeur_tarif where distributeur_id = $1 order by cree_le desc limit 1', [distributeurId]);
    if (!t) { await etat('echec', 'Aucun tarif déposé.'); return; }
    await etat('en_cours', `Lecture de « ${t.nom} » par Claude…`);
    const vins = await lireVinsDuTarif(Buffer.from(t.octets));
    if (!vins.length) { await etat('echec', `Aucun vin trouvé dans « ${t.nom} ».`); return; }
    const n = await enregistrerVinsDuTarif(requete, distributeurId, vins);
    await etat('terminee', `${n.lus} vins lus dans « ${t.nom} » : ${n.nouveaux} nouveaux, ${n.retires} retirés, ${n.rattaches} rattachés à un producteur de la base.`);
  } catch (e) {
    console.error('[tarif]', distributeurId, e);
    await etat('echec', `La lecture n’a pas abouti : ${(e as Error).message}`.slice(0, 500));
  }
}
