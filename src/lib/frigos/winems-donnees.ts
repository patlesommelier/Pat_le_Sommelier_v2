// Lecture de l'accès réservé de WineMS (GET /quidvinum/frigos, clé dans l'en-tête x-api-key). Sans « server-only » : testé seul.

export interface BouteilleWineMS {
  id: string | number; emplacement: string | null; entreeLe: string | null; millesime: number | null;
  vin: { id: string | number; nom: string; producteur: string | null; appellation: string | null; couleur: string | null; cepages: string | null; pays: string | null } | null;
  prixClient: number | null; prixFinal: number | null;
}
export interface FrigoWineMS {
  id: string | number; nom: string; emplacement: string | null; capacite: number | null; statut: number | null; statutDepuis: string | null;
  temperature: number | null; temperatureLe: string | null; bouteilles: BouteilleWineMS[];
}
export interface ClientWineMS { id: string | number; nom: string; delaiFacturationMinutes: number | null; frigos: FrigoWineMS[] }

/** Clients WineMS, leurs frigos et les bouteilles présentes ; erreur explicite si WineMS refuse ou ne répond pas. */
export async function lireFrigosWineMS(url: string, cle: string, lire: typeof fetch = fetch): Promise<ClientWineMS[]> {
  const r = await lire(`${url.replace(/\/$/, '')}/quidvinum/frigos`, { headers: { 'x-api-key': cle, accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (r.status === 401) throw new Error('WineMS refuse la clé WINEMS_API_KEY (différente de QUIDVINUM_API_KEY dans WineMS).');
  if (r.status === 503) throw new Error('WineMS : l’accès Quid Vinum n’est pas configuré (QUIDVINUM_API_KEY manque dans WineMS).');
  if (!r.ok) throw new Error(`WineMS a répondu ${r.status}.`);
  const d = await r.json() as { clients?: ClientWineMS[] };
  if (!Array.isArray(d?.clients)) throw new Error('Réponse de WineMS illisible.');
  return d.clients.map((c) => ({ ...c, frigos: (c.frigos ?? []).map((f) => ({ ...f, bouteilles: f.bouteilles ?? [] })) }));
}
