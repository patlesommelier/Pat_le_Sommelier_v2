import { requete } from '@/lib/db';
import { verifierSignature } from '@/lib/wine-labs-signature';
import { appliquerReponse, lireRequete } from '@/lib/etiquettes/wine-labs';

export const dynamic = 'force-dynamic';

/**
 * Secrets de signature possibles : celui enregistré en branchant le webhook depuis le super-admin (le plus récent),
 * puis la variable Netlify WINE_LABS_WEBHOOK_SECRET (webhook enregistré depuis le tableau de bord Wine Labs).
 */
async function secretsWebhook() {
  const [r] = await requete<{ valeur: string }>(`select valeur from reglage_serveur where cle = 'wine_labs_webhook_secret'`);
  return [r?.valeur, process.env.WINE_LABS_WEBHOOK_SECRET?.trim()].filter((x): x is string => Boolean(x));
}

/**
 * Webhook Wine Labs : https://<site>/api/webhooks/wine-labs
 * Wine Labs y envoie { id, event, created_at, attempt, data: { request } } quand une demande d'étiquette est
 * fulfilled, unavailable ou failed, signé par X-WineLabs-Signature (t=…,v1=<hex HMAC-SHA256 de « t.corps »>).
 * Réponse 2xx = bien reçu ; 401 = signature refusée ; 500 = erreur de notre côté (Wine Labs réessaie 8 fois en 2 jours).
 */
export async function POST(req: Request) {
  const secrets = await secretsWebhook();
  if (!secrets.length) {
    console.error('[wine-labs] secret du webhook absent (WINE_LABS_WEBHOOK_SECRET ou branchement depuis le super-admin)');
    return Response.json({ erreur: 'webhook non configuré' }, { status: 500 });
  }
  const corps = await req.text();
  const essais = secrets.map((secret) => verifierSignature(corps, req.headers, secret));
  const v = essais.find((e) => e.ok) ?? essais[0];
  if (!v.ok) {
    // On journalise les noms d'en-têtes (jamais leurs valeurs) pour ajuster la vérification si besoin.
    console.warn(`[wine-labs] refusé : ${essais.map((e) => (e.ok ? 'ok' : e.raison)).join(' / ')} (${secrets.length} secret(s)) ; en-têtes : ${[...req.headers.keys()].join(', ')}`);
    return Response.json({ erreur: 'signature' }, { status: 401 });
  }

  let objet: Record<string, unknown>;
  try {
    objet = JSON.parse(corps);
  } catch {
    return Response.json({ erreur: 'JSON invalide' }, { status: 400 });
  }
  if (String(objet.event ?? '') === 'wine_label.test') return Response.json({ ok: true, test: true });

  const livraison = req.headers.get('x-winelabs-delivery-id') ?? String(objet.id ?? '');
  const cle = `wine_labs:${livraison || v.id}`;
  try {
    // Une même livraison ne s'applique qu'une fois (marquée seulement une fois appliquée).
    if ((await requete('select 1 from webhook_recu where id = $1', [cle])).length) return Response.json({ ok: true, doublon: true });
    const d = lireRequete(objet);
    const r = await appliquerReponse(requete, d, (objet.data as Record<string, unknown> | undefined)?.request ?? objet);
    if (!r.applique) console.warn(`[wine-labs] demande ${d.id || '?'} (${d.statut}) : ${r.raison}`);
    await requete(`insert into webhook_recu (id, source) values ($1, 'wine_labs') on conflict do nothing`, [cle]);
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[wine-labs] erreur', e);
    return Response.json({ erreur: 'serveur' }, { status: 500 });
  }
}
