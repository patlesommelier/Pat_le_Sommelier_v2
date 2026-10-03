import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérification des webhooks Wine Labs (POST signé envoyé quand une demande d'étiquette est
 * fulfilled, unavailable ou failed ; le corps est l'objet « request » de l'API).
 *
 * Le secret (whsec_…) est lu dans WINE_LABS_WEBHOOK_SECRET : il ne doit jamais être écrit dans le code.
 *
 * Schéma vérifié : « Standard Webhooks » (en-têtes webhook-id, webhook-timestamp, webhook-signature,
 * signature = HMAC-SHA256 de « id.timestamp.corps », en base64, préfixée « v1, »), celui qu'utilisent
 * les secrets « whsec_ ». Variante acceptée : en-tête « …-signature: t=…,v1=<hex> » signant « t.corps ».
 * Si Wine Labs documente un autre schéma, seule cette fonction change.
 */

const TOLERANCE_S = 5 * 60;

function cles(secret: string): Buffer[] {
  const brut = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const out = [Buffer.from(secret, 'utf8'), Buffer.from(brut, 'utf8')];
  if (/^[0-9a-f]+$/i.test(brut) && brut.length % 2 === 0) out.push(Buffer.from(brut, 'hex'));
  if (/^[A-Za-z0-9+/=]+$/.test(brut)) out.push(Buffer.from(brut, 'base64'));
  return out;
}

function egal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type Verification = { ok: true; id: string } | { ok: false; raison: string };

export function verifierSignature(corps: string, entetes: Headers, secret: string, maintenant = Date.now()): Verification {
  const h = (n: string) => entetes.get(n) ?? entetes.get(`svix-${n.replace('webhook-', '')}`);
  const id = h('webhook-id');
  const ts = h('webhook-timestamp');
  const sig = h('webhook-signature');

  // Standard Webhooks
  if (id && ts && sig) {
    if (Math.abs(maintenant / 1000 - Number(ts)) > TOLERANCE_S) return { ok: false, raison: 'horodatage trop ancien' };
    const signees = sig.split(' ').map((s) => s.split(',')[1]).filter(Boolean);
    for (const k of cles(secret)) {
      const attendu = createHmac('sha256', k).update(`${id}.${ts}.${corps}`).digest('base64');
      if (signees.some((s) => egal(s, attendu))) return { ok: true, id };
    }
    return { ok: false, raison: 'signature invalide' };
  }

  // Variante « t=…,v1=… »
  const nomEntete = [...entetes.keys()].find((k) => k.endsWith('-signature') || k === 'signature');
  const valeur = nomEntete ? entetes.get(nomEntete)! : '';
  const t = valeur.match(/(?:^|,)t=(\d+)/)?.[1];
  const v1 = [...valeur.matchAll(/(?:^|,)v1=([0-9a-f]+)/g)].map((m) => m[1]);
  if (t && v1.length) {
    if (Math.abs(maintenant / 1000 - Number(t)) > TOLERANCE_S) return { ok: false, raison: 'horodatage trop ancien' };
    for (const k of cles(secret)) {
      const attendu = createHmac('sha256', k).update(`${t}.${corps}`).digest('hex');
      if (v1.some((s) => egal(s, attendu))) return { ok: true, id: `${t}.${v1[0].slice(0, 16)}` };
    }
    return { ok: false, raison: 'signature invalide' };
  }
  return { ok: false, raison: 'en-têtes de signature absents' };
}

/** Lit l'objet « request » sans présumer de noms de champs qu'on ne connaît pas encore avec certitude. */
export function lireDemande(o: Record<string, unknown>) {
  const r = (o.request ?? o.data ?? o) as Record<string, unknown>;
  const id = String(r.request_id ?? r.id ?? '');
  const statut = String(r.status ?? r.state ?? '').toLowerCase();
  const res = (r.result ?? r.label ?? r.wine_label ?? {}) as Record<string, unknown>;
  const image = [r.image_url, r.label_url, r.url, res.image_url, res.url, res.label_url]
    .find((x): x is string => typeof x === 'string' && /^https:\/\//.test(x)) ?? null;
  return { id, statut, image };
}
