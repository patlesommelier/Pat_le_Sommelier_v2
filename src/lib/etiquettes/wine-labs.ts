/**
 * Demandes d'étiquettes à Wine Labs (API Imagery : https://winelabs.ai/api/docs#imagery).
 *
 * - POST https://external-api.wine-labs.com/wine_labels { query, vintage, label_type, vintage_treatment, client_request_id }
 *   → request { id, status: fulfilled | processing | unavailable | failed, asset_url, … }.
 *   Une étiquette déjà connue arrive tout de suite ; sinon « processing », et le webhook apporte la réponse.
 * - Seules les demandes abouties coûtent (1 crédit). On n'en fait qu'une par cuvée : la réponse rejoint la cuvée
 *   et toutes les cartes qui l'ont (voir partage.ts).
 * - asset_url est un lien signé valable 7 jours : l'image est copiée dans notre stockage (Supabase « medias »).
 *
 * File : vin_carte.etiquette_statut = 'a_demander', traitée par netlify/functions/etiquettes-wine-labs-background.mts.
 * Sans 'server-only' : utilisé par cette fonction Netlify comme par le serveur Next.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Requete } from '../generation/accords';
import { partagerEtiquettes } from './partage';

export const API_WINE_LABS = process.env.WINE_LABS_API_URL ?? 'https://external-api.wine-labs.com'; // surchargé seulement pour les tests

/** Clé d'API (en-tête Authorization) ou, à défaut, user_id du compte. Lues dans les variables d'environnement. */
export function identifiantsWineLabs() {
  const cle = process.env.WINE_LABS_API_KEY ?? process.env.WINELABS_API_KEY ?? process.env.WINE_LABS_KEY ?? null;
  const userId = process.env.WINE_LABS_USER_ID ?? process.env.WINELABS_USER_ID ?? null;
  return cle || userId ? { cle, userId } : null;
}

/** Appel à l'API Wine Labs. Lève une erreur lisible si la réponse n'est pas 2xx. */
export async function appelerWineLabs<T = Record<string, unknown>>(methode: 'GET' | 'POST' | 'DELETE', chemin: string, corps?: Record<string, unknown>): Promise<T> {
  const id = identifiantsWineLabs();
  if (!id) throw new Error('Wine Labs non configuré : WINE_LABS_API_KEY (ou WINE_LABS_USER_ID) manquante dans Netlify.');
  const url = new URL(chemin, API_WINE_LABS);
  if (!id.cle && id.userId && methode !== 'POST') url.searchParams.set('user_id', id.userId);
  const r = await fetch(url, {
    method: methode,
    headers: { 'content-type': 'application/json', ...(id.cle ? { authorization: `Bearer ${id.cle}` } : {}) },
    body: methode === 'POST' ? JSON.stringify({ ...(!id.cle && id.userId ? { user_id: id.userId } : {}), ...corps }) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const texte = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(texte); } catch { /* réponse non JSON */ }
  if (!r.ok) {
    const detail = (json as { detail?: unknown; error?: unknown } | null)?.detail ?? (json as { error?: unknown } | null)?.error ?? texte.slice(0, 200);
    throw new Error(`Wine Labs ${r.status} : ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }
  return json as T;
}

/** Vins qui attendent la même réponse que le vin $1 : même cuvée, ou même nom sur la même carte (millésimes, formats). */
const JUMEAUX = `(v.id = $1 or exists (select 1 from vin_carte x where x.id = $1
  and ((x.cuvee_id is not null and v.cuvee_id = x.cuvee_id) or (v.restaurant_id = x.restaurant_id and lower(v.libelle) = lower(x.libelle)))))`;

export type DemandeWineLabs = { id: string; statut: string; image: string | null; vinId: string | null };

/** Objet « request » de Wine Labs (réponse de POST /wine_labels, ou data.request du webhook). */
export function lireRequete(o: unknown): DemandeWineLabs {
  const racine = (o ?? {}) as Record<string, unknown>;
  const data = racine.data as Record<string, unknown> | undefined;
  const r = (data?.request ?? racine.request ?? racine) as Record<string, unknown>;
  const lien = process.env.WINE_LABS_API_URL ? /^https?:\/\// : /^https:\/\//; // http seulement face au faux serveur des tests
  const image = [r.asset_url, r.image_url, r.url].find((x): x is string => typeof x === 'string' && lien.test(x)) ?? null;
  return {
    id: String(r.id ?? r.request_id ?? ''),
    statut: String(r.status ?? '').toLowerCase(),
    image,
    vinId: typeof r.client_request_id === 'string' && r.client_request_id ? r.client_request_id : null,
  };
}

/** Copie l'image de Wine Labs dans notre stockage (le lien signé expire après 7 jours). */
async function copierImage(source: string, requestId: string): Promise<string> {
  const r = await fetch(source, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`téléchargement de l'étiquette impossible (${r.status})`);
  const type = (r.headers.get('content-type') ?? 'image/png').split(';')[0];
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[type] ?? 'png';
  const octets = Buffer.from(await r.arrayBuffer());
  const nom = `wine-labs/${requestId.replace(/[^a-z0-9-]/gi, '')}-${createHash('sha1').update(octets).digest('hex').slice(0, 10)}.${ext}`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && cle) {
    const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: seaux } = await sb.storage.listBuckets();
    if (!seaux?.some((b) => b.name === 'medias')) await sb.storage.createBucket('medias', { public: true });
    const { error } = await sb.storage.from('medias').upload(nom, octets, { contentType: type, upsert: true });
    if (error) throw new Error(`dépôt de l'étiquette impossible : ${error.message}`);
    return sb.storage.from('medias').getPublicUrl(nom).data.publicUrl;
  }
  if (process.env.NETLIFY) throw new Error('Stockage non configuré : SUPABASE_SERVICE_ROLE_KEY manquante.');
  const cible = path.join(process.cwd(), 'public', 'uploads', nom);
  await fs.mkdir(path.dirname(cible), { recursive: true });
  await fs.writeFile(cible, octets);
  return `/uploads/${nom}`;
}

/**
 * Applique une réponse de Wine Labs (immédiate ou par webhook). Idempotent : une même réponse peut arriver
 * plusieurs fois, ou plus tard avec une image remplacée. Une photo du restaurant n'est jamais remplacée.
 */
export async function appliquerReponse(q: Requete, d: DemandeWineLabs, payload: unknown = null) {
  if (!d.id) return { applique: false, raison: 'sans identifiant' };
  const [dem] = await q<{ vin_id: string | null }>(
    `insert into demande_etiquette (request_id, vin_id, restaurant_id, cuvee_id, statut, asset_url, payload, recue_le)
     select $1, v.id, v.restaurant_id, v.cuvee_id, $3, $4, $5, case when $3 <> 'processing' then now() end
       from (select $2::text as id) x left join vin_carte v on v.id = x.id
     on conflict (request_id) do update set statut = excluded.statut, asset_url = coalesce(excluded.asset_url, demande_etiquette.asset_url),
       payload = coalesce(excluded.payload, demande_etiquette.payload), recue_le = coalesce(excluded.recue_le, demande_etiquette.recue_le),
       vin_id = coalesce(demande_etiquette.vin_id, excluded.vin_id)
     returning vin_id`, [d.id, d.vinId, d.statut, d.image, payload ? JSON.stringify(payload) : null]);
  const vinId = dem?.vin_id ?? null;
  if (!vinId) return { applique: false, raison: 'reliée à aucun vin' };

  if (d.statut === 'fulfilled' && d.image) {
    const image = await copierImage(d.image, d.id);
    await q('update demande_etiquette set image_url = $2 where request_id = $1', [d.id, image]);
    await q(
      `update vin_carte set etiquette_url = $2, etiquette_source = 'wine_labs', etiquette_statut = 'trouvee'
        where id = $1 and coalesce(etiquette_source, '') not in ('restaurant', 'fichier')`, [vinId, image]);
    await partagerEtiquettes(q, { vins: [vinId] }); // la cuvée et les autres cartes qui l'ont
    // Même vin sur la même carte, sans cuvée (producteur inconnu) : autres millésimes ou formats.
    await q(
      `update vin_carte v set etiquette_url = $2, etiquette_source = 'wine_labs', etiquette_statut = 'trouvee'
        where ${JUMEAUX} and v.id <> $1 and (v.etiquette_url is null or v.etiquette_source = 'wine_labs')`, [vinId, image]);
    return { applique: true };
  }
  if (d.statut === 'processing') {
    await q(`update vin_carte set etiquette_statut = 'demandee' where id = $1 and etiquette_url is null`, [vinId]);
    return { applique: true };
  }
  if (d.statut === 'unavailable' || d.statut === 'failed') {
    const statut = d.statut === 'unavailable' ? 'introuvable' : 'echec';
    // Le vin demandé et ceux de sa cuvée qui attendaient la même réponse.
    await q(
      `update vin_carte v set etiquette_statut = $2 where v.etiquette_url is null
          and (v.id = $1 or v.etiquette_statut is null or v.etiquette_statut in ('a_demander', 'demandee')) and ${JUMEAUX}`, [vinId, statut]);
    return { applique: true };
  }
  return { applique: false, raison: `statut ${d.statut}` };
}

/**
 * Met en file les vins d'un restaurant (ou les vins donnés) qui n'ont pas d'étiquette : une demande par cuvée,
 * rien pour un vin déjà demandé, introuvable, ou dont la cuvée a déjà une étiquette ou une demande en cours.
 * `relancer` : redonne une chance aux vins en échec. Renvoie le nombre de vins mis en file.
 */
export async function mettreEnFile(q: Requete, restaurantId: string, { vins, max = Number(process.env.WINE_LABS_MAX_PAR_LOT ?? 80), relancer = false }:
  { vins?: string[]; max?: number; relancer?: boolean } = {}) {
  if (!identifiantsWineLabs()) return 0;
  const r = await q<{ id: string }>(
    `with candidats as (
       select distinct on (coalesce(v.cuvee_id, lower(v.libelle))) v.id
         from vin_carte v left join cuvee c on c.id = v.cuvee_id
        where v.restaurant_id = $1 and v.disponible and v.etiquette_url is null
          and ($2::text[] is null or v.id = any($2))
          and (v.etiquette_statut is null or ($3 and v.etiquette_statut = 'echec'))
          and c.etiquette_url is null
          and not exists (select 1 from vin_carte o where o.etiquette_statut in ('a_demander', 'demandee', 'introuvable')
                            and ((v.cuvee_id is not null and o.cuvee_id = v.cuvee_id)
                                 or (o.restaurant_id = v.restaurant_id and lower(o.libelle) = lower(v.libelle))))
        order by coalesce(v.cuvee_id, lower(v.libelle)), v.ordre
        limit $4)
     update vin_carte v set etiquette_statut = 'a_demander' from candidats c where v.id = c.id returning v.id`,
    [restaurantId, vins ?? null, relancer, max]);
  return r.length;
}

/** Texte envoyé à Wine Labs : producteur et nom du vin tel qu'il figure sur la carte (appellation et cuvée). */
export function requeteTexte(v: { libelle: string; producteur: string | null }) {
  const libelle = v.libelle.trim();
  if (!v.producteur) return libelle;
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return norm(libelle).includes(norm(v.producteur)) ? libelle : `${v.producteur} ${libelle}`;
}

/**
 * Envoie les demandes en file, une à une, jusqu'à `finAvant`. Renvoie le nombre de vins encore en file
 * (0 si Wine Labs refuse : clé, crédits ou limite — la file reste et repartira à la prochaine recherche).
 */
export async function traiterFile(q: Requete, { finAvant }: { finAvant: number }) {
  while (Date.now() < finAvant) {
    const [v] = await q<{ id: string; libelle: string; producteur: string | null; millesime: string | null }>(
      `update vin_carte set etiquette_statut = 'demandee'
        where id = (select id from vin_carte where etiquette_statut = 'a_demander' order by restaurant_id, ordre limit 1 for update skip locked)
        returning id, libelle, coalesce((select nom from producteur p where p.id = producteur_id), producteur_texte) as producteur, millesime`);
    if (!v) break;
    try {
      const millesime = v.millesime?.match(/\b(19|20)\d{2}\b/)?.[0];
      const rep = await appelerWineLabs('POST', '/wine_labels', {
        query: requeteTexte(v), label_type: 'front_label',
        // Étiquette de la cuvée, partagée entre millésimes : la meilleure image validée, millésime visible ou non.
        vintage_treatment: 'any', ...(millesime ? { vintage: millesime } : {}),
        client_request_id: v.id,
      });
      const d = lireRequete(rep);
      await appliquerReponse(q, { ...d, vinId: d.vinId ?? v.id }, rep);
    } catch (e) {
      console.error('[wine-labs] demande', v.id, e);
      if (/\b(401|402|403|429)\b/.test(String(e))) {
        // Clé refusée, crédits épuisés ou limite : on n'insiste pas, le vin repart en file pour plus tard.
        await q(`update vin_carte set etiquette_statut = 'a_demander' where id = $1 and etiquette_url is null`, [v.id]);
        return 0;
      }
      await q(`update vin_carte set etiquette_statut = 'echec' where id = $1 and etiquette_url is null`, [v.id]);
    }
  }
  const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from vin_carte where etiquette_statut = 'a_demander'`);
  return n;
}
