import 'server-only';
// Recherche d'adresses dans OpenStreetMap, pour vérifier l'adresse d'un restaurant (Paramètres du restaurant).
// Photon (komoot) d'abord, fait pour la saisie au fil de la frappe ; Nominatim (OpenStreetMap) s'il ne répond pas.
// Résultats orientés vers la Belgique (proximité de Bruxelles), sans exclure les autres pays.

export interface AdresseOsm { ligne1: string; ligne2: string; pays: string; lat: number; lon: number }

const AGENT = () => `QuidVinum/1.0 (${(process.env.URL_ADMIN ?? 'https://quidvinum.be').replace(/\/$/, '')})`;
const BRUXELLES = { lat: 50.85, lon: 4.35 };

/** Texte d'une adresse choisie, tel qu'enregistré : « rue numéro », « code postal ville », et le pays hors Belgique. */
export const texteAdresse = (a: AdresseOsm) => [a.ligne1, a.ligne2, /^(belgique|belgium|belgië)$/i.test(a.pays) ? '' : a.pays].filter(Boolean).join('\n');

const assembler = (p: { rue?: string; numero?: string; nom?: string; cp?: string; ville?: string; pays?: string }, lat: number, lon: number): AdresseOsm | null => {
  if (!p.rue && !p.nom) return null;
  const ligne1 = p.rue ? [p.rue, p.numero].filter(Boolean).join(' ') : p.nom!;
  return { ligne1, ligne2: [p.cp, p.ville].filter(Boolean).join(' '), pays: p.pays ?? '', lat, lon };
};

async function photon(q: string): Promise<AdresseOsm[]> {
  const url = `https://photon.komoot.io/api/?${new URLSearchParams({ q, lang: 'fr', limit: '8', lat: String(BRUXELLES.lat), lon: String(BRUXELLES.lon) })}`;
  const r = await fetch(url, { headers: { 'user-agent': AGENT() }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Photon ${r.status}`);
  const j = await r.json() as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
  return (j.features ?? []).map(({ geometry: { coordinates: [lon, lat] }, properties: p }) => assembler({
    rue: p.street ?? (p.type === 'street' ? p.name : undefined), numero: p.housenumber, nom: p.name,
    cp: p.postcode, ville: p.city ?? p.town ?? p.village ?? p.district ?? p.county, pays: p.country }, lat, lon)).filter((a): a is AdresseOsm => a !== null);
}

async function nominatim(q: string): Promise<AdresseOsm[]> {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '6', 'accept-language': 'fr' })}`;
  const r = await fetch(url, { headers: { 'user-agent': AGENT() }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const j = await r.json() as { lat: string; lon: string; name?: string; address?: Record<string, string> }[];
  return j.map((x) => { const a = x.address ?? {};
    return assembler({ rue: a.road ?? a.pedestrian, numero: a.house_number, nom: x.name, cp: a.postcode,
      ville: a.city ?? a.town ?? a.village ?? a.municipality, pays: a.country }, Number(x.lat), Number(x.lon)); })
    .filter((a): a is AdresseOsm => a !== null);
}

/** Propositions d'adresses pour un texte tapé (au moins 4 caractères) ; [] si aucun service ne répond. */
export async function chercherAdresses(q: string): Promise<AdresseOsm[]> {
  const texte = q.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (texte.length < 4) return [];
  let res: AdresseOsm[] = [];
  try { res = await photon(texte); } catch (e) { console.error('[adresse] Photon', (e as Error).message); }
  if (!res.length) try { res = await nominatim(texte); } catch (e) { console.error('[adresse] Nominatim', (e as Error).message); }
  // Une seule fois chaque adresse (OpenStreetMap a souvent plusieurs objets au même endroit).
  const vues = new Set<string>();
  return res.filter((a) => { const k = texteAdresse(a).toLowerCase(); if (vues.has(k)) return false; vues.add(k); return true; }).slice(0, 6);
}
