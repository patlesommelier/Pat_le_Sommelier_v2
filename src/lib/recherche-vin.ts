// « Trouver un vin » (espace restaurant) : la demande du restaurant, décrite librement (plat, pays, budget, style…),
// devient des propositions dans les catalogues des distributeurs Quid Vinum, avec un petit texte de Pat : 4 vins par distributeur
// quand il y en a 1 ou 2, sinon 2 vins par distributeur.
//   1. Claude comprend la demande (critères) ;
//   2. présélection sans IA dans les catalogues (épuisés, budget, vins déjà en cave écartés ; rankings de Pat pour classer) ;
//   3. Claude choisit les vins de chaque distributeur selon les principes de Pat et écrit pourquoi.
// Les rankings, le prix QV et la marge ne sortent jamais d'ici : le restaurant voit son prix d'achat HTVA et le texte de Pat.
// Sans « server-only » : lancé en arrière-plan.
import type Anthropic from '@anthropic-ai/sdk';
import type { Requete } from './generation/accords';
import { clientClaude, modeleAccords } from './claude';

// Choix des vins et textes de Pat : Opus (accords plus fins, quelques centimes de plus par recherche).
const modeleRecherche = () => process.env.PAT_MODELE_RECHERCHE || 'claude-opus-5-5';
import { textePlat, textePrincipes, type PlatCtx, type PrincipeCtx } from './pat-cerveau';
import { distributeurPermis } from './distributeurs/verrou';

export interface VinPropose {
  id: string; libelle: string; producteur: string | null; appellation: string | null; millesime: string | null; contenance: string | null;
  couleur: string | null; prix: number | null; etiquette: string | null; pourquoi: string;
}
export interface PropositionDistributeur { id: string; nom: string; logo: string | null; vins: VinPropose[] }

interface Criteres { couleurs: string[]; lieux: string[]; budget_max: number | null; plat: string | null; style: string | null }
interface Candidat {
  id: string; distributeur_id: string; distributeur: string; logo: string | null; libelle: string; producteur: string | null;
  appellation: string | null; region: string | null; pays: string | null; cepages: string | null; millesime: string | null; contenance: string | null;
  couleur: string | null; prix: number | null; etiquette: string | null; ranking: number;
}

const COULEURS = ['bulles', 'blanc', 'rose', 'orange', 'rouge', 'doux'];
const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Premier objet JSON d'une réponse de Claude. */
function json<T>(texte: string): T | null {
  const m = texte.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

/** `claude` : client Claude (remplaçable pour les essais). */
export async function chercherVins(requete: Requete, rechercheId: string, claude?: Pick<Anthropic, 'messages'>) {
  const fin = (statut: 'terminee' | 'echec', message: string, resultat: PropositionDistributeur[] | null = null) =>
    requete('update recherche_vin set statut = $2, message = $3, resultat = $4 where id = $1', [rechercheId, statut, message, resultat ? JSON.stringify(resultat) : null]);
  try {
    const [r] = await requete<{ restaurant_id: string; demande: string; plat_id: string | null; budget: number | null; couleur: string | null }>(
      'select restaurant_id, demande, plat_id, budget::float8 as budget, couleur from recherche_vin where id = $1', [rechercheId]);
    if (!r) return;
    const resto = r.restaurant_id;
    const [plat] = r.plat_id ? await requete<PlatCtx>(
      `select pl.id, pl.nom, pl.categorie::text as categorie, pl.description_cuisine, coalesce(pa.ancrages, '{}') as ancrages, pa.profil,
              coalesce(pa.couleurs_ok::text[], '{}') as couleurs_ok, coalesce(pa.cepages_conseilles, '{}') as cepages_conseilles,
              pa.a_eviter, pa.temperature_service, coalesce(pa.principes, '{}') as principes, pa.plafond
         from plat pl left join profil_accord pa on pa.plat_id = pl.id where pl.id = $1 and pl.restaurant_id = $2`, [r.plat_id, resto]) : [];
    const client = claude ?? clientClaude({ maxRetries: 2, suivi: { poste: 'rajouter un vin', restaurant: resto } });

    // 1. La demande en critères (petit modèle, peu cher).
    const texteDemande = [r.demande, plat ? `Plat du menu choisi : ${plat.nom}${plat.description_cuisine ? ` (${plat.description_cuisine})` : ''}` : null,
      r.budget ? `Budget : ${r.budget} € HTVA la bouteille au plus` : null, r.couleur ? `Couleur souhaitée : ${r.couleur}` : null].filter(Boolean).join('\n');
    // Étape non bloquante : si elle échoue, la recherche continue avec la demande telle quelle (et les champs du formulaire).
    const m1 = await client.messages.create({ model: modeleAccords(), max_tokens: 4000, messages: [{ role: 'user', content:
      `Un restaurant cherche un vin à ajouter à sa cave. Voici sa demande :\n${texteDemande}\n\n`
      + `Réponds uniquement en JSON : {"couleurs": [parmi ${COULEURS.map((x) => `"${x}"`).join(', ')} ; vide si libre], `
      + `"lieux": [lieux souhaités, vide si libre : pour chacun, le pays en français, en anglais et dans sa langue, la région, et ses principales appellations `
      + `(ex. Toscane → "Italie", "Italy", "Italia", "Toscane", "Toscana", "Chianti", "Brunello di Montalcino", "Bolgheri", "Vino Nobile di Montepulciano")], `
      + `"budget_max": nombre en euros HTVA ou null, "plat": "le plat à accorder, décrit en une phrase" ou null, "style": "le style de vin souhaité en quelques mots" ou null}` }] }).catch((e) => { console.error('[trouver un vin] critères', e); return null; });
    const c = (m1 && json<Criteres>(m1.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))) ?? { couleurs: [], lieux: [], budget_max: null, plat: null, style: null };
    const couleurs = [...new Set([...(r.couleur ? [r.couleur] : []), ...(c.couleurs ?? [])].filter((x) => COULEURS.includes(x)))];
    const budget = r.budget ?? (typeof c.budget_max === 'number' && c.budget_max > 0 ? c.budget_max : null);
    const lieux = (c.lieux ?? []).map(sansAccents).filter((x) => x.length > 2);

    // 2. Présélection : vins actifs des distributeurs Quid Vinum proposés à ce restaurant, au prix du restaurant.
    const [m] = await requete<{ valeur: string }>(`select valeur from reglage_serveur where cle = 'qv_marge'`);
    const margeDefaut = Number.isFinite(Number(m?.valeur)) && m?.valeur ? Number(m.valeur) : 15;
    const tous = await requete<Candidat>(
      `select v.id, d.id as distributeur_id, d.nom as distributeur, d.logo_url as logo, v.libelle, coalesce(p.nom, v.producteur_texte) as producteur,
              coalesce(c.appellation_texte, t.nom, v.appellation) as appellation, coalesce(t.region, p.region, v.section) as region, coalesce(p.pays, t.pays) as pays,
              c.cepages, v.millesime, v.contenance, coalesce(c.couleur::text, v.couleur) as couleur,
              round(v.prix_qv * (1 + coalesce(f.marge, $2) / 100), 2)::float8 as prix, coalesce(v.etiquette_url, c.etiquette_url) as etiquette,
              coalesce(c.ranking_pat, p.ranking_pat, 3)::float8 + coalesce(t.ranking_pat, 3)::float8 / 10 as ranking
         from distributeur_vin v join distributeur d on d.id = v.distributeur_id and d.actif
         left join producteur p on p.id = v.producteur_id left join cuvee c on c.id = v.cuvee_id and c.statut <> 'retire'
         left join terroir t on t.id = c.appellation_id
         left join fournisseur f on f.distributeur_id = d.id and f.restaurant_id = $1
        where v.actif and not v.epuise and ${distributeurPermis('$1')}
          and not exists (select 1 from vin_carte x where x.restaurant_id = $1 and x.distributeur_vin_id = v.id)`, [resto, margeDefaut]);
    const lieuDe = (v: Candidat) => sansAccents([v.appellation, v.region, v.pays, v.libelle, v.producteur].filter(Boolean).join(' '));
    const retenus = tous.filter((v) => (!couleurs.length || (v.couleur && couleurs.includes(v.couleur))) && (!budget || (v.prix != null && v.prix <= budget)));
    // Le lieu demandé passe devant (sans écarter les autres : il y en a parfois peu) ; puis les rankings de Pat.
    // Avec un budget : les vins proches du budget (sans le dépasser) passent devant les vins bien moins chers.
    const procheBudget = (v: Candidat) => (budget && v.prix != null ? 4 * Math.min(1, v.prix / budget) : 0);
    const score = (v: Candidat) => (lieux.length && lieux.some((l) => lieuDe(v).includes(l)) ? 10 : 0) + v.ranking + procheBudget(v);
    // Un même vin n'est proposé qu'une fois par distributeur (deux millésimes ou formats ne font qu'une proposition) :
    // la bouteille de 75 cl et le millésime le plus récent de préférence.
    const cle = (v: Candidat) => `${v.distributeur_id}|${sansAccents(v.libelle).replace(/[^a-z0-9]+/g, ' ').trim()}`;
    const bouteille = (v: Candidat) => (/75\s*cl|0[,.]75/i.test(v.contenance ?? '') ? 1 : 0);
    const annee = (v: Candidat) => Number(v.millesime) || 0;
    // Vins proposés par distributeur : 4 quand il y a 1 ou 2 distributeurs, 2 à partir de 3 ; présélection en conséquence.
    const nbDistributeurs = new Set(retenus.map((v) => v.distributeur_id)).size;
    const parVins = nbDistributeurs <= 2 ? 4 : 2;
    const PAR_DISTRIBUTEUR = parVins === 4 ? 24 : 14; // vins présélectionnés par distributeur, soumis à Pat
    const parDistributeur = new Map<string, Candidat[]>();
    const vus = new Set<string>();
    for (const v of retenus.sort((a, b) => score(b) - score(a) || bouteille(b) - bouteille(a) || annee(b) - annee(a))) {
      if (vus.has(cle(v))) continue;
      vus.add(cle(v));
      const l = parDistributeur.get(v.distributeur_id) ?? [];
      if (l.length < PAR_DISTRIBUTEUR) parDistributeur.set(v.distributeur_id, [...l, v]);
    }
    if (!parDistributeur.size) {
      await fin('terminee', 'Aucun vin des catalogues ne correspond à ces critères (couleur, budget) : élargissez la demande.', []);
      return;
    }

    // 3. Pat choisit les vins de chaque distributeur et explique pourquoi.
    const principes = await requete<PrincipeCtx>(`select id, numero, titre, regle, role, statut::text from principe where statut <> 'retire'`);
    const liste = [...parDistributeur.entries()].map(([id, vins]) => `DISTRIBUTEUR ${id} (${vins[0].distributeur})\n${vins.map((v) =>
      `- ${v.id} : ${v.libelle}${v.millesime && !v.libelle.includes(v.millesime) ? ` ${v.millesime}` : ''}`
      + ` · ${[v.producteur, v.appellation, v.region, v.pays, v.cepages, v.couleur, v.contenance].filter(Boolean).join(' · ')}`
      + `${v.prix != null ? ` · ${v.prix.toFixed(2)} € HTVA` : ''}`).join('\n')}`).join('\n\n');
    // Marge large : la réflexion d'Opus compte dans max_tokens (une réponse coupée serait illisible).
    const m2 = await client.messages.create({ model: modeleRecherche(), max_tokens: 16000, messages: [{ role: 'user', content:
      `Tu es Pat, sommelier. Un restaurant cherche un vin à ajouter à sa cave, chez les distributeurs de Quid Vinum.

PRINCIPES DE PAT (ta doctrine pour choisir)
${textePrincipes(principes)}

DEMANDE DU RESTAURANT
${texteDemande}
${c.plat ? `Plat à accorder : ${c.plat}\n` : ''}${c.style ? `Style recherché : ${c.style}\n` : ''}${plat ? `\n${textePlat(plat)}\n` : ''}
VINS DISPONIBLES, PAR DISTRIBUTEUR (déjà triés : les premiers conviennent le mieux)
${liste}

${budget ? `Budget : ${budget} € HTVA au plus. Propose des vins qui s'en approchent (idéalement entre 70 % et 100 % du budget), jamais au-dessus ; un vin bien moins cher seulement s'il convient nettement mieux.\n` : ''}Pour chaque distributeur, choisis les ${parVins} vins qui répondent le mieux à la demande (moins s'il n'y en a pas assez qui conviennent ; aucun si rien ne convient).
Pour chacun, écris « pourquoi » : 2 phrases (35 à 55 mots en tout), en français, adressées au restaurant, qui disent pourquoi ce vin répond
à sa demande (accord avec le plat, style, origine, budget), par la cause (acidité, texture, arômes, terroir, cépage…), sans adjectif creux.
Ne cite ni note, ni classement, ni principe, ni prix d'achat de Quid Vinum.
Réponds uniquement en JSON : {"distributeurs": [{"id": "...", "vins": [{"id": "...", "pourquoi": "..."}]}]}` }] });
    const choix = json<{ distributeurs: { id: string; vins: { id: string; pourquoi: string }[] }[] }>(m2.content.map((b) => (b.type === 'text' ? b.text : '')).join(''));
    if (!choix?.distributeurs) {
      await fin('echec', 'Pat n’a pas pu terminer la recherche : relancez-la.');
      await requete('update recherche_vin set erreur = $2 where id = $1', [rechercheId, `Réponse illisible (fin : ${m2.stop_reason}) : ${m2.content.map((b) => (b.type === 'text' ? b.text : '')).join('').slice(0, 600)}`]);
      return;
    }
    const resultat: PropositionDistributeur[] = [];
    for (const [id, vins] of parDistributeur) {
      const pris = (choix.distributeurs.find((x) => x.id === id)?.vins ?? [])
        .map((x) => ({ v: vins.find((y) => y.id === x.id), pourquoi: (x.pourquoi ?? '').trim() }))
        .filter((x): x is { v: Candidat; pourquoi: string } => Boolean(x.v && x.pourquoi)).slice(0, parVins);
      if (!pris.length) continue;
      resultat.push({ id, nom: vins[0].distributeur, logo: vins[0].logo, vins: pris.map(({ v, pourquoi }) => ({
        id: v.id, libelle: v.libelle, producteur: v.producteur, appellation: v.appellation, millesime: v.millesime, contenance: v.contenance,
        couleur: v.couleur, prix: v.prix, etiquette: v.etiquette, pourquoi })) });
    }
    await fin('terminee', resultat.length ? '' : 'Aucun vin des catalogues ne répond vraiment à cette demande : précisez-la ou élargissez-la.', resultat);
  } catch (e) {
    console.error('[trouver un vin]', rechercheId, e);
    await fin('echec', 'La recherche n’a pas abouti : relancez-la dans un instant.');
    // Détail technique : pour le super-admin seulement.
    await requete('update recherche_vin set erreur = $2 where id = $1', [rechercheId, String((e as Error)?.message ?? e).slice(0, 1000)]).catch(() => undefined);
  }
}
