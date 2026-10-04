/**
 * Commentaires d'accord de la table mets/vins, générés plat par plat (tous les vins d'un plat en une passe).
 * Les notes ne changent pas : seuls le commentaire client (`explication`) et le champ interne `limite` sont écrits.
 *
 *   npm run commentaires -- --restaurant lola                    → aperçu dans data/commentaires-<resto>.json, rien en base
 *   npm run commentaires -- --restaurant lola --plat lola-solettes-meuniere
 *   npm run commentaires -- --restaurant lola --ecrire           → écrit aussi en base (accords d'origine « pat »)
 *
 * Après génération, chaque commentaire est contrôlé (scripts/lib/commentaires.ts) : mots interdits, longueur,
 * élément propre au vin, plat conseillé pour un vin noté 2/5 ou moins, quasi-doublons dans le plat.
 * Les fautifs sont régénérés (2 fois au plus) ; ceux qui restent fautifs sont signalés et ne sont pas écrits.
 * Variables : DATABASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL (facultatif).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { controlerPlat, MOTS_INTERDITS, MOTS_MAX, MOTS_MIN, type VinAControler } from '../src/lib/generation/controle';
import { ouvrirPool } from './lib/migrations';

const arg = (nom: string) => { const i = process.argv.indexOf(`--${nom}`); return i > -1 ? process.argv[i + 1] : undefined; };
const RESTAURANT = arg('restaurant') ?? 'lola';
const SEUL_PLAT = arg('plat');
const ECRIRE = process.argv.includes('--ecrire');
const MODELE = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5';
const ESSAIS = 2;
const EN_PARALLELE = 3;

interface Plat { id: string; nom: string; nom_court: string | null; categorie: string; description_cuisine: string | null;
  ancrages: string[] | null; profil: string | null; a_eviter: string | null; temperature_service: string | null }
interface Vin { id: string; libelle: string; couleur: string; cepages: string | null; producteur: string | null; millesime: string | null;
  appellation: string | null; descriptif: string | null }
interface Accord { plat_id: string; vin_id: string; note: number; explication: string | null }
interface Genere { vin: string; commentaire: string; limite: string | null }

const SYSTEME = `Tu es Pat, sommelier. Tu écris les commentaires d'accord mets/vins d'une carte de restaurant : une phrase par vin, lue par le client sur son téléphone.

Chaque commentaire :
- une seule phrase de ${MOTS_MIN} à ${MOTS_MAX} mots (vise 15 à 20), en français, sans guillemets ;
- dit pourquoi l'accord fonctionne, par la cause (acidité, gras, sel, texture, arômes…), jamais par un adjectif creux ;
- cite au moins un élément propre au vin : son cépage, son terroir, son élevage, son dosage ou son producteur ;
- est positif : il dit ce qui fonctionne, jamais ce qui ne fonctionne pas ;
- ne cite ni note, ni classement, ni principe, ni le mot « accord » en ouverture.

Varie les angles d'un vin à l'autre d'un même plat : texture, écho aromatique, structure, origine, moment du repas. Deux commentaires d'un même plat ne commencent jamais de la même façon et ne se ressemblent pas.

Mots et tournures interdits, sous toutes leurs formes : ${MOTS_INTERDITS.map(([m]) => `« ${m} »`).join(', ')}.

Vin noté 2/5 ou moins sur ce plat : le commentaire dit ce que le vin a de beau et nomme le plat de la carte (indiqué) sur lequel il s'exprimera mieux, toujours en positif.

Pour chaque vin, ajoute un champ interne « limite » : en quelques mots, ce qui empêche une note plus haute sur ce plat (null si la note est 5). Ce champ n'est jamais montré au client : c'est là, et seulement là, que tu peux être critique.

Réponds uniquement avec un tableau JSON, sans texte autour, un objet par vin demandé, dans l'ordre :
[{"vin": "L-B02", "commentaire": "…", "limite": "…"}]`;

function textePlat(p: Plat) {
  return [
    `PLAT : ${p.nom} (${p.categorie})`,
    p.description_cuisine ? `Description du chef : ${p.description_cuisine}` : null,
    p.ancrages?.length ? `Points d'ancrage : ${p.ancrages.join(', ')}` : null,
    p.profil ? `Profil de vin recherché : ${p.profil}` : null,
    p.a_eviter ? `À éviter : ${p.a_eviter}` : null,
  ].filter(Boolean).join('\n');
}

function texteVin(v: Vin, note: number, meilleurPlat: string | null, defauts?: string[]) {
  return [
    `${v.id} | note ${note}/5 | ${v.libelle}${v.millesime ? ` ${v.millesime}` : ''} | ${v.couleur}`,
    `producteur : ${v.producteur ?? '—'}`,
    `cépages : ${v.cepages ?? '—'}`,
    v.appellation ? `appellation : ${v.appellation}` : null,
    v.descriptif ? `descriptif : ${v.descriptif.replace(/\s+/g, ' ').slice(0, 500)}` : null,
    note <= 2 && meilleurPlat ? `plat où il s'exprimera mieux : ${meilleurPlat}` : null,
    defauts?.length ? `À CORRIGER : ${defauts.join(' ; ')}` : null,
  ].filter(Boolean).join(' | ');
}

function lireJson(texte: string): Genere[] {
  const debut = texte.indexOf('['), fin = texte.lastIndexOf(']');
  if (debut < 0 || fin < debut) throw new Error('réponse sans tableau JSON');
  const brut = JSON.parse(texte.slice(debut, fin + 1)) as unknown[];
  return brut.flatMap((x) => {
    const o = x as Record<string, unknown>;
    return typeof o?.vin === 'string' && typeof o?.commentaire === 'string'
      ? [{ vin: o.vin, commentaire: o.commentaire.trim(), limite: typeof o.limite === 'string' && o.limite.trim() ? o.limite.trim() : null }]
      : [];
  });
}

async function main() {
  const pool = ouvrirPool();
  const q = async <T>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  const client = new Anthropic();

  const plats = await q<Plat>(
    `select pl.id, pl.nom, pl.nom_court, pl.categorie::text, pl.description_cuisine, pa.ancrages, pa.profil, pa.a_eviter, pa.temperature_service
       from plat pl left join profil_accord pa on pa.plat_id = pl.id
      where pl.restaurant_id = $1 and pl.actif order by pl.ordre`, [RESTAURANT]);
  const vins = new Map((await q<Vin>(
    `select v.id, v.libelle, v.couleur::text, v.cepages, coalesce(p.nom, v.producteur_texte) as producteur, v.millesime,
            split_part(coalesce(v.vin_texte, ''), ' – ', 1) as appellation, v.descriptif
       from vin_carte v left join producteur p on p.id = v.producteur_id where v.restaurant_id = $1`, [RESTAURANT])).map((v) => [v.id, v]));
  const accords = await q<Accord>(
    `select plat_id, vin_id, note, explication from accord
      where restaurant_id = $1 and note is not null and origine = 'pat' order by plat_id, note desc, rang nulls last`, [RESTAURANT]);
  if (!plats.length || !accords.length) throw new Error(`Rien à générer pour « ${RESTAURANT} » (plats ou accords absents).`);

  const nomPlat = new Map(plats.map((p) => [p.id, p.nom_court ?? p.nom]));
  const ordrePlat = new Map(plats.map((p, i) => [p.id, i]));
  /** Plat où le vin est le mieux noté (hors plat courant), pour les vins notés 2/5 ou moins. */
  const meilleurPlat = (vin: string, sauf: string) => {
    const autres = accords.filter((a) => a.vin_id === vin && a.plat_id !== sauf && nomPlat.has(a.plat_id))
      .sort((a, b) => b.note - a.note || (ordrePlat.get(a.plat_id)! - ordrePlat.get(b.plat_id)!));
    return autres[0] && autres[0].note >= 3 ? nomPlat.get(autres[0].plat_id)! : null;
  };

  const cibles = plats.filter((p) => !SEUL_PLAT || p.id === SEUL_PLAT);
  const resultats: { plat: string; vins: (Genere & { note: number; ancien: string | null; defauts: string[] })[] }[] = [];
  let entree = 0, sortie = 0;

  async function appeler(contenu: string) {
    const m = await client.messages.stream({ model: MODELE, max_tokens: 32000, system: SYSTEME, messages: [{ role: 'user', content: contenu }] }).finalMessage();
    entree += m.usage.input_tokens; sortie += m.usage.output_tokens;
    if (m.stop_reason === 'max_tokens') throw new Error('réponse coupée (max_tokens)');
    return lireJson(m.content.map((b) => (b.type === 'text' ? b.text : '')).join(''));
  }

  async function traiterPlat(p: Plat) {
    const lignes = accords.filter((a) => a.plat_id === p.id && vins.has(a.vin_id));
    if (!lignes.length) return;
    const aControler = (g: Map<string, Genere>): VinAControler[] => lignes.filter((a) => g.has(a.vin_id)).map((a) => {
      const v = vins.get(a.vin_id)!;
      return { vin: a.vin_id, note: a.note, commentaire: g.get(a.vin_id)!.commentaire,
        reperes: [v.cepages ?? '', v.producteur ?? '', v.appellation ?? '', v.libelle].filter(Boolean),
        meilleurPlat: a.note <= 2 ? meilleurPlat(a.vin_id, p.id) : null };
    });

    // 1. Tous les vins du plat en une passe
    const generes = new Map<string, Genere>();
    for (const g of await appeler(`${textePlat(p)}\n\nVINS À COMMENTER (${lignes.length})\n${lignes.map((a) => texteVin(vins.get(a.vin_id)!, a.note, meilleurPlat(a.vin_id, p.id))).join('\n')}`)) {
      if (lignes.some((a) => a.vin_id === g.vin)) generes.set(g.vin, g);
    }
    // 2. Contrôle, puis régénération des fautifs (et des oubliés), avec les commentaires déjà retenus pour éviter les redites
    let defauts = controlerPlat(aControler(generes));
    for (const a of lignes) if (!generes.has(a.vin_id)) defauts.set(a.vin_id, ['commentaire absent de la réponse']);
    for (let essai = 1; essai <= ESSAIS && defauts.size; essai++) {
      const retenus = lignes.filter((a) => generes.has(a.vin_id) && !defauts.has(a.vin_id)).map((a) => `- ${generes.get(a.vin_id)!.commentaire}`);
      const fautifs = lignes.filter((a) => defauts.has(a.vin_id));
      const refaits = await appeler(`${textePlat(p)}\n\nCOMMENTAIRES DÉJÀ ÉCRITS POUR CE PLAT (ne pas les répéter, ne pas commencer de la même façon)\n${retenus.join('\n') || '—'}\n\n` +
        `VINS À RÉÉCRIRE (${fautifs.length})\n${fautifs.map((a) => texteVin(vins.get(a.vin_id)!, a.note, meilleurPlat(a.vin_id, p.id), defauts.get(a.vin_id))).join('\n')}`);
      for (const g of refaits) if (defauts.has(g.vin)) generes.set(g.vin, g);
      defauts = controlerPlat(aControler(generes));
      for (const a of lignes) if (!generes.has(a.vin_id)) defauts.set(a.vin_id, ['commentaire absent de la réponse']);
    }

    resultats.push({ plat: p.id, vins: lignes.map((a) => ({
      vin: a.vin_id, note: a.note, ancien: a.explication, defauts: defauts.get(a.vin_id) ?? [],
      commentaire: generes.get(a.vin_id)?.commentaire ?? '', limite: generes.get(a.vin_id)?.limite ?? null,
    })) });
    const ko = defauts.size;
    console.log(`${p.id} : ${lignes.length - ko}/${lignes.length} commentaires valides${ko ? ` (${ko} à revoir : ${[...defauts.keys()].join(', ')})` : ''}`);

    if (ECRIRE) {
      for (const v of resultats.at(-1)!.vins.filter((x) => !x.defauts.length && x.commentaire)) {
        await q(`update accord set explication = $4, limite = $5, explication_generee_le = now()
                  where restaurant_id = $1 and plat_id = $2 and vin_id = $3 and origine = 'pat'`, [RESTAURANT, p.id, v.vin, v.commentaire, v.limite]);
      }
    }
  }

  // Quelques plats en parallèle, chacun en une passe
  const file = [...cibles];
  await Promise.all(Array.from({ length: Math.min(EN_PARALLELE, file.length) }, async () => {
    for (let p = file.shift(); p; p = file.shift()) {
      try { await traiterPlat(p); } catch (e) { console.error(`${p.id} : échec (${(e as Error).message}) — rien n'est écrit pour ce plat`); }
    }
  }));

  const sortieFichier = path.join('data', `commentaires-${RESTAURANT}.json`);
  fs.writeFileSync(sortieFichier, JSON.stringify(resultats.sort((a, b) => ordrePlat.get(a.plat)! - ordrePlat.get(b.plat)!), null, 2));
  const total = resultats.reduce((n, r) => n + r.vins.length, 0);
  const aRevoir = resultats.reduce((n, r) => n + r.vins.filter((v) => v.defauts.length).length, 0);
  console.log(`\n${total - aRevoir}/${total} commentaires valides, ${aRevoir} à revoir. Aperçu : ${sortieFichier}`);
  console.log(ECRIRE ? 'Commentaires valides écrits en base.' : 'Rien n\'a été écrit en base : relancer avec --ecrire pour enregistrer.');
  console.log(`Jetons : ${entree.toLocaleString('fr-BE')} en entrée, ${sortie.toLocaleString('fr-BE')} en sortie (modèle ${MODELE}).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
