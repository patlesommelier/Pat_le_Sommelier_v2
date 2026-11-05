// Lecture de la carte des vins ou du menu déposés sur la page d'accueil, en arrière-plan
// (une requête classique est coupée vers 26 secondes sur Netlify ; une fonction d'arrière-plan a 15 minutes).
// File : inscription.lecture.<type>.statut = 'en_attente', posé au dépôt des fichiers.
// Sans 'server-only' : exécuté par netlify/functions/analyser-inscription-background.mts (et par le serveur en local).
import type { Requete } from '../generation/accords';
import { dedoublonnerPlats, dedoublonnerVins, Plat, unSeulVerre, validerListe, Vin } from './donnees';
import type { TypeAnalyse } from './etapes';
import { analyserCarte, analyserMenu, rapprocherVins, type FichierEnvoye } from './lecture';
import { avecSuivi } from '../claude';

const ECHEC: Record<TypeAnalyse, string> = {
  carte: 'Pat n’a pas réussi à lire cette carte. Essayez des images plus nettes, une par page, ou le PDF.',
  menu: 'Pat n’a pas réussi à lire ce menu. Essayez des images plus nettes, une par page, ou le PDF.',
};

/** Échec venant du service Claude et non du document : message à montrer, ou null. */
export function serviceIndisponible(e: unknown): string | null {
  const err = e as { status?: number; message?: string } | null;
  const texte = String(err?.message ?? '');
  if (err?.status === 429 || err?.status === 529 || /overloaded|rate.?limit/i.test(texte))
    return 'Pat est très sollicité en ce moment : réessayez dans quelques minutes avec le même fichier.';
  if (/credit balance|billing/i.test(texte) || err?.status === 401 || err?.status === 403 || (err?.status ?? 0) >= 500)
    return 'La lecture est momentanément indisponible : réessayez un peu plus tard avec le même fichier.';
  return null;
}

/** Prend la prochaine lecture en attente (deux fonctions ne prennent jamais la même). */
async function prendre(q: Requete): Promise<{ id: string; type: TypeAnalyse } | null> {
  for (const type of ['carte', 'menu'] as const) {
    const [r] = await q<{ id: string }>(
      `update inscription set lecture = jsonb_set(lecture, $1, lecture->$2 || jsonb_build_object('statut', 'en_cours', 'lanceeLe', now()))
        where id = (select id from inscription where statut = 'en_cours' and lecture->$2->>'statut' = 'en_attente'
                     order by maj_le for update skip locked limit 1)
        returning id`, [`{${type}}`, type]);
    if (r) return { id: r.id, type };
  }
  return null;
}

/** Lit les fichiers d'une étape et enregistre le résultat (il remplace le précédent : « Remplacer » repart de zéro). */
export async function executerAnalyse(q: Requete, inscriptionId: string, type: TypeAnalyse) {
  // Consommation notée sous « lecture carte » / « lecture menu », rattachée au restaurant une fois créé (par l'inscription).
  return avecSuivi({ poste: `lecture ${type}`, inscription: inscriptionId }, () => lireEtEnregistrer(q, inscriptionId, type));
}

async function lireEtEnregistrer(q: Requete, inscriptionId: string, type: TypeAnalyse) {
  const ecrire = (champ: 'vins' | 'plats', liste: unknown[], etat: Record<string, unknown>) =>
    q(`update inscription set ${champ} = $3, lecture = jsonb_set(lecture, $2, $4), maj_le = now() where id = $1`,
      [inscriptionId, `{${type}}`, JSON.stringify(liste), JSON.stringify(etat)]);
  try {
    const fichiers = await q<FichierEnvoye>(
      `select nom, media_type as type, octets from inscription_fichier where inscription_id = $1 and type = $2 order by cree_le, nom`,
      [inscriptionId, type]);
    if (!fichiers.length) throw new Error('aucun fichier');
    const lus = fichiers.map((f) => ({ ...f, octets: new Uint8Array(f.octets as unknown as Buffer) }));
    if (type === 'carte') {
      const { ok } = validerListe(Vin, await analyserCarte(lus));
      const vins = await rapprocherVins(q, dedoublonnerVins(unSeulVerre(ok)));
      if (!vins.length) throw new Error('aucun vin reconnu');
      await ecrire('vins', vins, { statut: 'ok', nombre: vins.length });
    } else {
      const { ok } = validerListe(Plat, await analyserMenu(lus));
      const plats = dedoublonnerPlats(ok);
      if (!plats.length) throw new Error('aucun plat reconnu');
      await ecrire('plats', plats, { statut: 'ok', nombre: plats.length });
    }
  } catch (e) {
    console.error('[inscription] lecture', inscriptionId, type, e);
    // Mauvais document (menu à la place de la carte, ou l'inverse) ou image illisible : le message exact ;
    // service Claude indisponible (crédit, surcharge, clé) : le dire, ce n'est pas la faute du document ; sinon, le message général.
    const message = e instanceof Error && (e.name === 'MauvaisDocument' || /illisible/.test(e.message)) ? e.message : (serviceIndisponible(e) ?? ECHEC[type]);
    // Détail technique gardé dans la base (jamais montré au restaurateur) pour comprendre un échec.
    const detail = String((e as { status?: number })?.status ?? '') + ' ' + String((e as Error)?.message ?? e).slice(0, 300);
    await q(`update inscription set lecture = jsonb_set(lecture, $2, $3), maj_le = now() where id = $1`,
      [inscriptionId, `{${type}}`, JSON.stringify({ statut: 'erreur', message, detail: detail.trim() })]);
  }
}

/** Traite les lectures en attente jusqu'à épuisement ou jusqu'à l'heure limite. Renvoie le nombre restant. */
export async function traiterAnalyses(q: Requete, { finAvant }: { finAvant: number }) {
  for (let t = await prendre(q); t; t = Date.now() < finAvant ? await prendre(q) : null) await executerAnalyse(q, t.id, t.type);
  const [{ n }] = await q<{ n: number }>(
    `select count(*)::int as n from inscription where statut = 'en_cours' and (lecture->'carte'->>'statut' = 'en_attente' or lecture->'menu'->>'statut' = 'en_attente')`);
  return n;
}
