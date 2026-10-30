// Stockage des images (logos, étiquettes, photos de plats) : Hetzner Object Storage, compatible S3.
// Une requête PUT signée (AWS Signature V4), sans dépendance. Le bucket est public en lecture : l'adresse renvoyée
// s'affiche telle quelle dans le site, l'app et les impressions.
// Sans « server-only » : utilisé aussi par les scripts (copie des photos depuis Supabase).
import { createHash, createHmac } from 'node:crypto';

export interface ConfigStockage { endpoint: string; region: string; bucket: string; cle: string; secret: string; urlPublique: string }

/** Réglages du stockage (variables STOCKAGE_S3_…) ; null s'il n'est pas configuré. */
export function configStockage(env: NodeJS.ProcessEnv = process.env): ConfigStockage | null {
  const endpoint = env.STOCKAGE_S3_ENDPOINT?.trim().replace(/\/$/, '');
  const bucket = env.STOCKAGE_S3_BUCKET?.trim();
  const cle = env.STOCKAGE_S3_ACCESS_KEY?.trim(), secret = env.STOCKAGE_S3_SECRET_KEY?.trim();
  if (!endpoint || !bucket || !cle || !secret) return null;
  const hote = new URL(endpoint).host;
  return {
    endpoint, bucket, cle, secret,
    region: env.STOCKAGE_S3_REGION?.trim() || hote.split('.')[0],
    // Adresse publique d'un objet : https://<bucket>.<hôte>/<nom> (ou STOCKAGE_URL_PUBLIQUE, par exemple un sous-domaine).
    urlPublique: (env.STOCKAGE_URL_PUBLIQUE?.trim() || `https://${bucket}.${hote}`).replace(/\/$/, ''),
  };
}

const sha256 = (d: string | Buffer) => createHash('sha256').update(d).digest('hex');
const hmac = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest();
/** Chemin d'un objet, encodé comme S3 l'attend (RFC 3986, les « / » gardés). */
const encoder = (nom: string) => nom.split('/').map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');

/** Dépose un objet et renvoie son adresse publique. Les noms sont uniques : l'image est gardée en cache un an. */
export async function deposerObjet(nom: string, octets: Buffer, type: string, c: ConfigStockage = configStockage()!, maintenant = new Date()): Promise<string> {
  if (!c) throw new Error('Stockage non configuré : variables STOCKAGE_S3_… manquantes.');
  const url = new URL(`${c.endpoint}/${c.bucket}/${encoder(nom)}`);
  const date = maintenant.toISOString().replace(/[-:]|\.\d{3}/g, ''); // 20261030T091500Z
  const jour = date.slice(0, 8);
  const empreinte = sha256(octets);
  const entetes: Record<string, string> = {
    'cache-control': 'public, max-age=31536000, immutable', 'content-type': type,
    host: url.host, 'x-amz-content-sha256': empreinte, 'x-amz-date': date,
  };
  const noms = Object.keys(entetes).sort();
  const canonique = ['PUT', url.pathname, '', ...noms.map((n) => `${n}:${entetes[n]}`), '', noms.join(';'), empreinte].join('\n');
  const portee = `${jour}/${c.region}/s3/aws4_request`;
  const aSigner = ['AWS4-HMAC-SHA256', date, portee, sha256(canonique)].join('\n');
  const cleSignature = hmac(hmac(hmac(hmac(`AWS4${c.secret}`, jour), c.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', cleSignature).update(aSigner).digest('hex');
  const { host: _hote, ...envoyes } = entetes;
  const r = await fetch(url, {
    method: 'PUT', body: new Uint8Array(octets), signal: AbortSignal.timeout(30_000),
    headers: { ...envoyes, authorization: `AWS4-HMAC-SHA256 Credential=${c.cle}/${portee}, SignedHeaders=${noms.join(';')}, Signature=${signature}` },
  });
  if (!r.ok) throw new Error(`Dépôt de l'image refusé par le stockage (${r.status}) : ${(await r.text()).slice(0, 200)}`);
  return `${c.urlPublique}/${encoder(nom)}`;
}
