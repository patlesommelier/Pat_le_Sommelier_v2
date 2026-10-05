import { headers } from 'next/headers';
import { brancherWebhookWineLabs, testerWebhookWineLabs } from '../actions';
import { Entete, Etat, Message } from '@/components/admin/Ui';
import { exigerAdmin } from '@/lib/admin/auth';
import { requete } from '@/lib/db';
import { appelerWineLabs, identifiantsWineLabs } from '@/lib/etiquettes/wine-labs';

export const dynamic = 'force-dynamic';

type Endpoint = { id: string; url: string; active?: boolean; consecutive_failures?: number; last_success_at?: string | null; last_error?: string | null };
type Credits = Record<string, number | null | undefined>;
const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default async function WineLabs({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await exigerAdmin(); // chaque page se protège : le layout ne suffit pas (rendu en parallèle)
  const sp = await searchParams;
  const h = await headers();
  const adresse = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/api/webhooks/wine-labs`;
  const id = identifiantsWineLabs();

  let endpoints: Endpoint[] = [], credits: Credits | null = null, erreurApi: string | null = null;
  if (id) {
    try {
      const [w, l] = await Promise.all([
        appelerWineLabs<{ endpoints?: Endpoint[] }>('GET', '/wine_labels/webhooks'),
        appelerWineLabs<{ credits?: Credits }>('GET', '/wine_labels?limit=1'),
      ]);
      endpoints = w.endpoints ?? [];
      credits = l.credits ?? null;
    } catch (e) {
      erreurApi = (e as Error).message;
    }
  }
  const notre = endpoints.find((e) => e.url === adresse);
  const [secret] = await requete<{ maj_le: string }>(`select maj_le from reglage_serveur where cle = 'wine_labs_webhook_secret'`);
  const [stats] = await requete<{ attente: number; trouvees: number; introuvables: number; echecs: number }>(
    `select count(*) filter (where etiquette_statut in ('a_demander', 'demandee') and etiquette_url is null)::int as attente,
            count(*) filter (where etiquette_source = 'wine_labs')::int as trouvees,
            count(*) filter (where etiquette_statut = 'introuvable')::int as introuvables,
            count(*) filter (where etiquette_statut = 'echec')::int as echecs from vin_carte`);
  const demandes = await requete<{ request_id: string; statut: string; libelle: string | null; restaurant: string | null; demandee_le: string }>(
    `select d.request_id, d.statut, v.libelle, r.nom as restaurant, d.demandee_le from demande_etiquette d
       left join vin_carte v on v.id = d.vin_id left join restaurant r on r.id = d.restaurant_id order by d.demandee_le desc limit 15`);

  return (
    <>
      <Entete titre="Wine Labs" texte="Étiquettes demandées automatiquement à Wine Labs quand une carte est chargée : une demande par cuvée, seules les étiquettes trouvées coûtent un crédit." />
      <Message ok={sp.ok} erreur={sp.erreur ?? erreurApi ?? undefined} />
      <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))' }}>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{stats.trouvees}</div><span className="discret">étiquettes Wine Labs</span></div>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{stats.attente}</div><span className="discret">en recherche</span></div>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{stats.introuvables}</div><span className="discret">introuvables</span></div>
        <div className="carte-bo" style={{ padding: '16px 20px' }}><div className="chiffre">{stats.echecs}</div><span className="discret">en échec</span></div>
      </div>

      <div className="carte-bo pile" style={{ maxWidth: 760 }}>
        <h2>Connexion</h2>
        <p style={{ margin: 0 }}>Clé d’API : {id ? <Etat type="ok">configurée</Etat> : <Etat type="attention">absente</Etat>}
          {!id && <span className="petit discret"> — ajoutez WINE_LABS_API_KEY dans les variables d’environnement de Netlify, puis redéployez.</span>}</p>
        {credits && <p style={{ margin: 0 }}>Crédits : {Object.entries(credits).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k} ${v}`).join(' · ')}</p>}
        <p style={{ margin: 0 }}>Webhook : {notre ? <Etat type={notre.active === false ? 'attention' : 'ok'}>{notre.active === false ? 'en pause' : 'branché'}</Etat> : <Etat type="attention">non branché</Etat>}
          <span className="petit discret"> {adresse}</span></p>
        {notre && <p className="petit discret" style={{ margin: 0 }}>Dernière livraison réussie : {date(notre.last_success_at)}{notre.consecutive_failures ? ` · ${notre.consecutive_failures} échec(s) de suite` : ''}{notre.last_error ? ` · ${notre.last_error}` : ''}</p>}
        {!process.env.WINE_LABS_WEBHOOK_SECRET && <p className="petit discret" style={{ margin: 0 }}>Secret de signature : {secret ? `enregistré le ${date(secret.maj_le)}` : 'aucun (branchez le webhook)'}</p>}
        {id && !erreurApi && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <form action={brancherWebhookWineLabs}><button className="btn sec">{notre ? 'Rebrancher le webhook' : 'Brancher le webhook'}</button></form>
            {notre && <form action={testerWebhookWineLabs.bind(null, notre.id)}><button className="btn fantome">Envoyer un test</button></form>}
          </div>
        )}
      </div>

      {demandes.length > 0 && (
        <div className="tableau">
          <table>
            <thead><tr><th>Vin</th><th>Restaurant</th><th>Statut</th><th>Demandé le</th></tr></thead>
            <tbody>{demandes.map((d) => (
              <tr key={d.request_id}><td>{d.libelle ?? '—'}</td><td>{d.restaurant ?? '—'}</td>
                <td><Etat type={d.statut === 'fulfilled' ? 'ok' : d.statut === 'processing' ? 'propose' : 'attention'}>{({ fulfilled: 'Trouvée', processing: 'En cours', unavailable: 'Introuvable', failed: 'Échec' } as Record<string, string>)[d.statut] ?? d.statut}</Etat></td>
                <td>{date(d.demandee_le)}</td></tr>))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
