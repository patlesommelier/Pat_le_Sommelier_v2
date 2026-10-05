/**
 * Versions des règles de sélection par défaut de Pat (table regles_version : V7 en service, brouillon, historique).
 * Chaque restaurant garde ses ajustements (restaurant.reglages_selection) par-dessus la version en service.
 * Côté serveur uniquement ; pas d'import « server-only » : utilisé aussi par les scripts.
 */
import type { Requete } from '../generation/accords';
import { parametresRegles, REGLAGES_PAT, type Reglages } from '../selection';

export interface LigneRegles { code: string; statut: string; parametres: Reglages; notes: string | null; cree_le: string; maj_le: string; publie_le: string | null; publie_par: string | null }

const lire = async (q: Requete, where: string, params: unknown[] = []) => {
  const [v] = await q<LigneRegles>(`select code, statut, parametres, notes, cree_le, maj_le, publie_le, publie_par from regles_version where ${where}`, params);
  return v ? { ...v, parametres: parametresRegles(v.parametres) } : null;
};
export const reglesEnService = (q: Requete) => lire(q, `statut = 'en_service'`);
export const brouillonRegles = (q: Requete) => lire(q, `statut = 'brouillon'`);
export const lireRegles = (q: Requete, code: string) => lire(q, 'code = $1', [code]);

/** Réglages par défaut en service ; avant la première version en base, ceux du code (REGLAGES_PAT, V7). */
export async function parametresEnService(q: Requete): Promise<Reglages> {
  try {
    return (await reglesEnService(q))?.parametres ?? REGLAGES_PAT;
  } catch {
    return REGLAGES_PAT; // table pas encore créée (migration 0013 non appliquée)
  }
}

export function validerParametres(p: Reglages): string[] {
  const e: string[] = [];
  const entier = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  if (!entier(p.noteEliminatoire, 0, 4)) e.push('Écarter les notes ≤ : entier de 0 à 4.');
  if (!entier(p.premiers, 1, 6)) e.push('Premiers vins : entier de 1 à 6.');
  if (!entier(p.maximum, p.premiers, 8)) e.push('Maximum : entier, au moins le nombre de premiers vins, 8 au plus.');
  if (!entier(p.noteMinAjout, 1, 5)) e.push('Note minimale pour compléter : entier de 1 à 5.');
  if (!entier(p.scoreMinAjout, 0, 10)) e.push('Score minimal pour compléter : entier de 0 à 10.');
  if (!(p.facteurPlusCher >= 1 && p.facteurPlusCher <= 5)) e.push('Vin plus cher : facteur de 1 à 5.');
  if (!(p.ecartMoinsCher >= 1 && p.ecartMoinsCher <= 5)) e.push('Vin moins cher : écart de 1 à 5.');
  if (!entier(p.plafondBulles, 0, 8)) e.push('Bulles au plus : entier de 0 à 8.');
  if (!entier(p.tourSuivant, 1, 6)) e.push('Tour suivant : entier de 1 à 6.');
  return e;
}

/** Première mise en place : la version en service est celle du code (règles V7). */
export async function installerReglesEnService(q: Requete, code: string, parametres: Reglages, par: string, notes: string | null = null) {
  await q(`update regles_version set statut = 'remplacee' where statut = 'en_service' and code <> $1`, [code]);
  await q(
    `insert into regles_version (code, statut, parametres, notes, publie_le, publie_par) values ($1, 'en_service', $2, $3, now(), $4)
     on conflict (code) do update set statut = 'en_service', parametres = excluded.parametres, notes = excluded.notes, maj_le = now()`,
    [code, JSON.stringify(parametres), notes, par]);
}

/** Crée ou modifie le brouillon des règles (copie de la version en service au départ) ; maj_le change à chaque écriture. */
export async function enregistrerBrouillonRegles(q: Requete, parametres: Reglages, notes: string | null = null) {
  const erreurs = validerParametres(parametres);
  if (erreurs.length) return { code: null, erreurs };
  const b = await brouillonRegles(q);
  let code = b?.code;
  if (!code) {
    const [r] = await q<{ n: number | null }>(`select max(nullif(regexp_replace(code, '\\D', '', 'g'), '')::int) as n from regles_version`);
    code = `V${(r?.n ?? 7) + 1}`;
  }
  await q(
    `insert into regles_version (code, statut, parametres, notes) values ($1, 'brouillon', $2, $3)
     on conflict (code) do update set parametres = excluded.parametres, notes = excluded.notes, maj_le = now()`,
    [code, JSON.stringify(parametres), notes]);
  return { code, erreurs: [] };
}

export async function listeVersionsRegles(q: Requete) {
  return q<Pick<LigneRegles, 'code' | 'statut' | 'notes' | 'publie_le' | 'publie_par' | 'maj_le'>>(
    `select code, statut, notes, publie_le, publie_par, maj_le from regles_version
      order by nullif(regexp_replace(code, '\\D', '', 'g'), '')::int desc nulls last, code desc`);
}
