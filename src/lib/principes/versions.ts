/**
 * Versions des principes de Pat en base (table principes_version) : une en service, au plus un brouillon, l'historique.
 * La table « principe » reste la copie de la version en service que lit la génération des accords :
 * elle est réécrite à chaque mise en service (synchroniserPrincipes).
 * Côté serveur uniquement ; pas d'import « server-only » : utilisé aussi par les scripts.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Requete } from '../generation/accords';
import type { PrincipeCtx } from '../pat-cerveau';
import { differences, ErreurFormat, lireFichier, valider, type Differences, type Principe, type VersionPrincipes } from './format';

export { N_SAUCE_A_PART } from './constantes';

export type StatutVersion = 'brouillon' | 'en_service' | 'remplacee' | 'archivee';
export interface LigneVersion extends VersionPrincipes {
  code: string; statut: StatutVersion; differences: Differences | null;
  source: { fichier?: string; importePar?: string; importeLe?: string } | null;
  cree_le: string; maj_le: string; publie_le: string | null; publie_par: string | null;
}

const COLONNES = 'code, statut, schema, principes, informations, questions, decisions, differences, source, cree_le, maj_le, publie_le, publie_par';

export async function lireVersion(q: Requete, code: string) {
  const [v] = await q<LigneVersion>(`select ${COLONNES} from principes_version where code = $1`, [code]);
  return v ?? null;
}
export async function versionEnService(q: Requete) {
  const [v] = await q<LigneVersion>(`select ${COLONNES} from principes_version where statut = 'en_service'`);
  return v ?? null;
}
export async function brouillon(q: Requete) {
  const [v] = await q<LigneVersion>(`select ${COLONNES} from principes_version where statut = 'brouillon'`);
  return v ?? null;
}
export async function listeVersions(q: Requete) {
  return q<Pick<LigneVersion, 'code' | 'statut' | 'cree_le' | 'maj_le' | 'publie_le' | 'publie_par' | 'source'>>(
    `select code, statut, cree_le, maj_le, publie_le, publie_par, source from principes_version
      order by nullif(regexp_replace(code, '\\D', '', 'g'), '')::int desc nulls last, code desc`);
}

/** Code de la prochaine version : V + (plus grand numéro existant + 1). */
async function prochainCode(q: Requete) {
  const [r] = await q<{ n: number | null }>(`select max(nullif(regexp_replace(code, '\\D', '', 'g'), '')::int) as n from principes_version`);
  return `V${(r?.n ?? 0) + 1}`;
}

export interface ResultatImport { code: string | null; erreurs: string[]; avertissements: string[]; differences: Differences | null }

/**
 * Importe un fichier (.xlsx ou .json) comme brouillon. Rien n'est écrit en cas d'erreur ou de simulation.
 * Un brouillon existant n'est remplacé que si `remplacerBrouillon`.
 */
export async function importerVersion(q: Requete, { nomFichier, contenu, par, simulation = false, remplacerBrouillon = false, code: codeImpose }:
  { nomFichier: string; contenu: Buffer; par: string; simulation?: boolean; remplacerBrouillon?: boolean; code?: string }): Promise<ResultatImport> {
  if (contenu.length > 2 * 1024 * 1024) return { code: null, erreurs: ['Fichier trop volumineux (2 Mo au plus).'], avertissements: [], differences: null };
  let version: VersionPrincipes;
  try {
    version = await lireFichier(nomFichier, contenu);
  } catch (e) {
    if (e instanceof ErreurFormat) return { code: null, erreurs: e.erreurs, avertissements: [], differences: null };
    return { code: null, erreurs: [`Fichier illisible : ${(e as Error).message}`], avertissements: [], differences: null };
  }
  const { erreurs, avertissements } = valider(version);
  const diff = differences(await versionEnService(q), version);
  if (erreurs.length || simulation) return { code: null, erreurs, avertissements, differences: diff };

  const actuel = await brouillon(q);
  if (actuel && !remplacerBrouillon) {
    return { code: null, erreurs: [`Un brouillon ${actuel.code} existe déjà : confirmez pour le remplacer par ce fichier.`], avertissements, differences: diff };
  }
  const code = codeImpose ?? actuel?.code ?? await prochainCode(q);
  if (actuel && actuel.code !== code) await q(`update principes_version set statut = 'archivee' where code = $1`, [actuel.code]);
  await q(
    `insert into principes_version (code, statut, schema, principes, informations, questions, decisions, differences, source)
     values ($1, 'brouillon', $2, $3, $4, $5, $6, $7, $8)
     on conflict (code) do update set statut = 'brouillon', schema = excluded.schema, principes = excluded.principes,
       informations = excluded.informations, questions = excluded.questions, decisions = excluded.decisions,
       differences = excluded.differences, source = excluded.source, maj_le = now()`,
    [code, version.schema, JSON.stringify(version.principes), JSON.stringify(version.informations), JSON.stringify(version.questions),
      JSON.stringify(version.decisions), JSON.stringify(diff), JSON.stringify({ fichier: nomFichier, importePar: par, importeLe: new Date().toISOString() })],
  );
  return { code, erreurs: [], avertissements, differences: diff };
}

/**
 * Première mise en place : enregistre une version directement en service (sans publication, les accords
 * en place ayant été calculés avec elle) et recopie ses principes dans la table « principe ».
 */
export async function installerEnService(q: Requete, code: string, version: VersionPrincipes, par: string, fichier: string) {
  await q(`update principes_version set statut = 'remplacee' where statut = 'en_service' and code <> $1`, [code]);
  await q(
    `insert into principes_version (code, statut, schema, principes, informations, questions, decisions, source, publie_le, publie_par)
     values ($1, 'en_service', $2, $3, $4, $5, $6, $7, now(), $8)
     on conflict (code) do update set statut = 'en_service', principes = excluded.principes, informations = excluded.informations,
       questions = excluded.questions, decisions = excluded.decisions, source = excluded.source, maj_le = now()`,
    [code, version.schema, JSON.stringify(version.principes), JSON.stringify(version.informations), JSON.stringify(version.questions),
      JSON.stringify(version.decisions), JSON.stringify({ fichier, importePar: par, importeLe: new Date().toISOString() }), par],
  );
  await synchroniserPrincipes(q, code, version.principes);
}

/** Modifie un principe du brouillon (règle, titre, tags, relu) : maj_le change, ce qui invalide une publication préparée. */
export async function modifierPrincipeBrouillon(q: Requete, n: number, champs: Partial<Pick<Principe, 'titre' | 'regle' | 'tags' | 'aRelire'>>) {
  const b = await brouillon(q);
  if (!b) throw new Error('Aucun brouillon à modifier.');
  const principes = b.principes.map((p) => {
    if (p.n !== n) return p;
    const nouveau = { ...p, ...champs };
    return { ...nouveau, statut: /^fusionné/i.test(nouveau.regle) || nouveau.tags.includes('archive') ? 'archive' as const : 'actif' as const };
  });
  const { erreurs, avertissements } = valider({ principes });
  await q(`update principes_version set principes = $2, differences = $3, maj_le = now() where code = $1`,
    [b.code, JSON.stringify(principes), JSON.stringify(differences(await versionEnService(q), { principes }))]);
  return { erreurs, avertissements };
}

// Rôle de chaque principe pour la génération (proposition relue par Pat) ; un nouveau principe n'a pas de rôle.
const ROLES: Record<string, string> = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'pat', 'roles_principes.proposition.json'), 'utf8')).roles ?? {};
  } catch {
    return {};
  }
})();

/** Principes d'une version au format de la génération : actifs seulement (un archivé n'est jamais transmis au modèle). */
export async function principesPourGeneration(q: Requete, version: Pick<VersionPrincipes, 'principes'>): Promise<PrincipeCtx[]> {
  const existants = new Map((await q<{ id: string; role: string | null; statut: string }>('select id, role, statut::text from principe'))
    .map((p) => [p.id, p]));
  return version.principes.filter((p) => p.statut === 'actif').map((p) => ({
    id: p.id, numero: p.n, titre: p.titre, regle: p.regle,
    role: (existants.get(p.id)?.role ?? ROLES[p.id] ?? null) as PrincipeCtx['role'],
    statut: existants.get(p.id)?.statut === 'propose' ? 'propose' : 'valide',
  }));
}

/**
 * Recopie une version dans la table « principe » (lue par la génération et le chat) :
 * actifs gardés ou ajoutés, archivés passés en « retire » ; rôle et statut de validation existants conservés.
 */
export async function synchroniserPrincipes(q: Requete, code: string, principes: Principe[]) {
  // Numéros libérés d'abord : un identifiant qui change pour un même numéro ne doit pas heurter l'unicité.
  await q(`update principe set numero = -numero where numero > 0 and not (id = any($1::text[]))`, [principes.map((p) => p.id)]);
  for (const p of principes) {
    await q(
      `insert into principe (id, numero, titre, regle, tags, role, statut, version_ajout)
       values ($1, $2, $3, $4, $5, $6, $7::statut_validation, $8)
       on conflict (id) do update set numero = excluded.numero, titre = excluded.titre, regle = excluded.regle, tags = excluded.tags,
         statut = case when excluded.statut = 'retire' then 'retire'::statut_validation
                       when principe.statut = 'retire' then 'valide'::statut_validation else principe.statut end,
         maj_le = now()`,
      [p.id, p.n, p.titre, p.regle, p.tags, ROLES[p.id] ?? null, p.statut === 'archive' ? 'retire' : 'valide', code],
    );
  }
  await q(`update principe set statut = 'retire', maj_le = now() where not (id = any($1::text[]))`, [principes.map((p) => p.id)]);
}
