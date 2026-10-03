import { requete } from '@/lib/db';
import { lireDemande, verifierSignature } from '@/lib/wine-labs';

export const dynamic = 'force-dynamic';

/**
 * Webhook Wine Labs : https://<site>/api/webhooks/wine-labs
 * Wine Labs appelle cette adresse quand une demande d'étiquette est fulfilled, unavailable ou failed.
 * Réponse 2xx = bien reçu ; 401 = signature refusée ; 500 = erreur de notre côté (Wine Labs peut réessayer).
 */
export async function POST(req: Request) {
  const secret = process.env.WINE_LABS_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[wine-labs] WINE_LABS_WEBHOOK_SECRET absente');
    return Response.json({ erreur: 'webhook non configuré' }, { status: 500 });
  }
  const corps = await req.text();
  const v = verifierSignature(corps, req.headers, secret);
  if (!v.ok) {
    // On journalise les noms d'en-têtes (jamais leurs valeurs) pour ajuster la vérification si besoin.
    console.warn(`[wine-labs] refusé : ${v.raison} ; en-têtes : ${[...req.headers.keys()].join(', ')}`);
    return Response.json({ erreur: 'signature' }, { status: 401 });
  }

  let objet: Record<string, unknown>;
  try {
    objet = JSON.parse(corps);
  } catch {
    return Response.json({ erreur: 'JSON invalide' }, { status: 400 });
  }
  const { id, statut, image } = lireDemande(objet);
  if (!id) return Response.json({ erreur: 'request_id absent' }, { status: 400 });

  try {
    // Un même message ne s'applique qu'une fois (il n'est marqué « traité » qu'une fois appliqué).
    const deja = await requete('select 1 from webhook_recu where id = $1', [v.id]);
    if (deja.length) return Response.json({ ok: true, doublon: true });

    const [d] = await requete<{ vin_id: string | null }>(
      `insert into demande_etiquette (request_id, statut, image_url, payload, recue_le)
       values ($1, $2, $3, $4, now())
       on conflict (request_id) do update set statut = excluded.statut, image_url = coalesce(excluded.image_url, demande_etiquette.image_url),
         payload = excluded.payload, recue_le = now()
       returning vin_id`,
      [id, statut, image, objet],
    );

    if (d?.vin_id) {
      if (statut === 'fulfilled' && image) {
        // Jamais au-dessus d'une photo ajoutée par le restaurant.
        await requete(
          `update vin_carte set etiquette_url = $2, etiquette_source = 'wine_labs', etiquette_statut = 'trouvee'
            where id = $1 and coalesce(etiquette_source, '') <> 'restaurant'`,
          [d.vin_id, image],
        );
      } else if (statut === 'unavailable' || statut === 'failed') {
        await requete(
          `update vin_carte set etiquette_statut = $2 where id = $1 and etiquette_url is null`,
          [d.vin_id, statut === 'unavailable' ? 'introuvable' : 'echec'],
        );
      }
    } else {
      console.warn(`[wine-labs] demande ${id} reçue (${statut}) mais reliée à aucun vin`);
    }
    await requete(`insert into webhook_recu (id, source) values ($1, 'wine_labs') on conflict do nothing`, [v.id]);
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[wine-labs] erreur', e);
    return Response.json({ erreur: 'serveur' }, { status: 500 });
  }
}
