import fs from 'node:fs';
import path from 'node:path';
import { cle, cleRegion, enObjets, entier, liste, lireFeuille, slug, texte, uniques } from './util';

export type Ligne = Record<string, unknown>;

// ───────────────────────────── Principes ─────────────────────────────

const ROLES: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join('data', 'pat', 'roles_principes.proposition.json'), 'utf8'),
).roles;

/** Principes V5 + questions pour Pat. Les n° ajoutés par Claude (V4, V5) restent « proposés » tant que Pat ne les a pas validés. */
export async function importerPrincipes(fichier: string) {
  const lignes = enObjets(await lireFeuille(fichier, 'Principes'));
  const versions = new Map<number, { version: string; lies: number[] }>();
  for (const [feuille, version] of [['Nouveautés V4', 'V4'], ['Nouveautés V5', 'V5']] as const) {
    for (const n of enObjets(await lireFeuille(fichier, feuille))) {
      const num = entier(n['N°']);
      if (num) versions.set(num, { version, lies: (String(n['Principes complétés'] ?? '').match(/\d+/g) ?? []).map(Number) });
    }
  }
  const idParNumero = new Map<number, string>();
  for (const l of lignes) if (entier(l['N°'])) idParNumero.set(entier(l['N°'])!, String(l['Identifiant']));

  const principes: Ligne[] = lignes
    .filter((l) => entier(l['N°']))
    .map((l) => {
      const numero = entier(l['N°'])!;
      const id = String(l['Identifiant']);
      const v = versions.get(numero);
      return {
        id,
        numero,
        titre: texte(l['Titre']),
        regle: texte(l['Règle']),
        tags: liste(l['Tags']),
        role: ROLES[id] ?? null,
        statut: v ? 'propose' : 'valide',
        version_ajout: v?.version ?? 'V3',
        principes_lies: (v?.lies ?? []).map((n) => idParNumero.get(n)).filter(Boolean),
      };
    });

  const questions: Ligne[] = enObjets(await lireFeuille(fichier, 'Questions pour Pat'))
    .filter((q) => entier(q['N°']))
    .map((q) => ({
      numero: entier(q['N°']),
      question: texte(q['Question']),
      principes: (String(q['Principe concerné'] ?? '').match(/\d+/g) ?? []).map(Number).map((n) => idParNumero.get(n)).filter(Boolean),
    }));
  return { principes, questions };
}

// ───────────────────────────── Terroirs ─────────────────────────────

function altitudes(a: unknown): [number | null, number | null] {
  const n = (String(a ?? '').match(/\d+/g) ?? []).map(Number);
  if (!n.length) return [null, null];
  return [n[0], n[1] ?? n[0]];
}

/** Type d'origine, légèrement uniformisé (lieu_dit → lieu-dit). Les fichiers en comptent une quarantaine. */
function typeTerroir(t: unknown): string {
  const s = String(t ?? '').trim();
  if (!s) return 'appellation';
  return /^lieu[_ -]dit$/i.test(s) ? 'lieu-dit' : s;
}

/** Range un type dans une des cinq familles de l'app : appellation, zone, cru, lieu-dit, autre. */
export function niveauTerroir(type: string): string {
  const s = slug(type);
  if (/cepage|style|mention|producteur/.test(s)) return 'autre';
  if (/premier-cru|grand-cru$|^cru|commune-cru|zone-cru/.test(s) && !/^appellation/.test(s)) return 'cru';
  if (/lieu-dit|climat|vigna|contrada|coteau|terrasse/.test(s)) return 'lieu-dit';
  if (/^appellation|denomination|^igp|^doc|^aoc/.test(s)) return 'appellation';
  if (/zone|secteur|sottozona|sous-region|vallee|commune/.test(s)) return 'zone';
  return 'appellation';
}

/** Identifiant court : ce qui suit « -terr- » / « -prod- », ou l'id sans son préfixe régional (bgn-, lr-, jus-…). */
function base(ancien: string, marque: string) {
  const i = ancien.indexOf(marque);
  if (i >= 0) return ancien.slice(i + marque.length);
  return ancien.replace(/^(bgn|bdx|loi|lr|jus|so|als|cha|bjs|prov|corse|aut|rhone)-/, '');
}

interface TerroirBrut { regionKey: string; item: Ligne }

/** Lit les terroirs (JSON par région + fichiers Excel « To_Import ») et les normalise. */
export async function importerTerroirs(dossier: string) {
  const bruts: TerroirBrut[] = [];
  for (const f of fs.readdirSync(dossier).sort()) {
    const p = path.join(dossier, f);
    if (f.endsWith('.json')) {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const it of d.items) bruts.push({ regionKey: d.region_key, item: it });
    } else if (f.endsWith('.xlsx')) {
      const regionKey = f.replace(/^terroirs_|\.xlsx$/g, '').replace(/_to_import/i, '');
      const feuille = (await import('exceljs')).default;
      const wb = new feuille.Workbook();
      await wb.xlsx.readFile(p);
      const nom = wb.worksheets[0].name;
      for (const r of enObjets(await lireFeuille(p, nom))) {
        if (!texte(r['Nom'])) continue;
        bruts.push({
          regionKey,
          item: {
            id: r['ID'], nom: r['Nom'], type: r['Type'], region: regionKey === 'piemonte' ? 'Piemonte' : regionKey,
            sous_region: r['Sous-région'], pays: regionKey === 'piemonte' ? 'Italie' : null,
            cepages_rois: liste(r['Cépages rois']), altitude: r['Altitude'], sols: r['Sols'],
            caracteristiques_rapides: r['Caractéristiques rapides'], notes_objectives: r['Notes objectives'],
            niveau_reference: r['Niveau réf.'], ranking_pat: r['Ranking Pat'], mes_notes: r['Mes notes (Pat)'],
            tags: liste(r['Tags']), source: r['Source'],
          },
        });
      }
    }
  }

  const unique = uniques();
  const terroirs: Ligne[] = bruts.map(({ regionKey, item: t }) => {
    const ancien = String(t.id ?? slug(String(t.nom)));
    const [amin, amax] = altitudes(t.altitude);
    const type = typeTerroir(t.type);
    return {
      id: unique(`${regionKey}-terr-${slug(base(ancien, '-terr-'))}`),
      ancien_id: ancien,
      nom: texte(t.nom),
      type,
      niveau: niveauTerroir(type),
      parent_id: null as string | null,
      pays: texte(t.pays) ?? 'France',
      region: texte(t.region),
      sous_region: texte(t.sous_region),
      cepages_rois: liste(t.cepages_rois),
      altitude_min: amin,
      altitude_max: amax,
      sols: liste(t.sols, /\s*\|\s*/),
      caracteristiques: texte(t.caracteristiques_rapides),
      notes_objectives: texte(t.notes_objectives),
      niveau_reference: entier(t.niveau_reference),
      ranking_pat: entier(t.ranking_pat),
      avis_critique: texte(t.mes_notes),
      avis_pat: texte(t.notes_pat),
      tags: liste(t.tags),
      source: texte(t.source),
      _region_key: regionKey,
    };
  });

  // Hiérarchie : un climat, un cru ou un lieu-dit est rangé sous l'appellation dont il porte le tag ou le nom.
  const appellations = terroirs.filter((t) => t.niveau === 'appellation');
  let relies = 0;
  for (const t of terroirs) {
    if (appellations.includes(t)) continue;
    const memeRegion = appellations.filter((a) => a._region_key === t._region_key);
    const tags = (t.tags as string[]).map(slug);
    const nomT = cle(String(t.nom));
    const parent =
      memeRegion.find((a) => tags.includes(slug(String(a.ancien_id))) || tags.some((g) => g.length > 4 && slug(String(a.ancien_id)).startsWith(g))) ??
      memeRegion
        .filter((a) => nomT.startsWith(cle(String(a.nom)).replace(/ aoc$/, '')))
        .sort((x, y) => String(y.nom).length - String(x.nom).length)[0];
    if (parent) { t.parent_id = parent.id as string; relies++; }
  }
  // Un lieu-dit qui porte aussi le tag d'un climat (La Landonne → Côte Brune) reste sous l'appellation : assez pour Pat.
  terroirs.forEach((t) => delete t._region_key);
  return { terroirs, stats: { total: terroirs.length, sous_appellation: relies } };
}

// ───────────────────────────── Producteurs et cuvées ─────────────────────────────

function statutProduction(v: unknown): { statut: string; precision: string | null } {
  const o = texte(v);
  if (!o) return { statut: 'inconnu', precision: null };
  const s = slug(o);
  const exact = ['conventionnel-raisonne', 'biologique', 'biodynamie', 'biodynamie-certifiee', 'nature'];
  let statut = 'inconnu';
  const nonCertifie = /non-certifi/.test(s);
  if (s.includes('biodynam')) statut = s.includes('certifi') && !nonCertifie ? 'biodynamie-certifiee' : 'biodynamie';
  else if (s.includes('bio')) statut = s.includes('certifi') && !nonCertifie ? 'biologique-certifie' : 'biologique';
  else if (s.includes('nature')) statut = 'nature';
  else if (s.includes('raisonn') || s.includes('conventionnel')) statut = 'conventionnel-raisonne';
  return { statut, precision: exact.includes(s) ? null : o };
}

const GAMMES: Record<string, string> = {
  '<15': '<15', '15-30': '15-30', '30-50': '30-50', '50-100': '50-100', '100-300': '100-300', '100-300+': '100-300', '>100': '100-300', '>300': '>300',
};

function couleurCuvee(s: string): string | null {
  const t = cle(s);
  if (/\brose\b/.test(t)) return 'rose';
  if (/\bblanc\b|blancs/.test(t)) return 'blanc';
  if (/brut|champagne|cremant|spumante|effervescent/.test(t)) return 'bulles';
  if (/\brouge\b/.test(t)) return 'rouge';
  return null;
}

export function cuveesDepuis(prod: Ligne, phrases: string[], terroirs: Ligne[]): Ligne[] {
  const unique = uniques();
  const parNom = [...terroirs].sort((a, b) => String(b.nom).length - String(a.nom).length);
  return phrases.map((phrase) => {
    const m = phrase.match(/^([^(]+?)\s*(?:\((.*)\))?\s*$/);
    const nom = (m?.[1] ?? phrase).trim();
    const desc = m?.[2]?.trim() ?? null;
    const k = cle(phrase);
    const app = parNom.find((t) => {
      const n = cle(String(t.nom)).replace(/ aoc$/, '').replace(/\(.*\)/, '').trim();
      return n.length > 3 && k.includes(n);
    });
    return {
      id: unique(`${prod.id}-${slug(nom)}`.slice(0, 120)),
      producteur_id: prod.id,
      nom,
      appellation_id: app?.id ?? null,
      couleur: couleurCuvee(phrase),
      cepages: null,
      garde: desc?.match(/garde[^,;]*/i)?.[0] ?? null,
      description: desc,
      texte_origine: phrase,
      statut: 'propose',
    };
  });
}

const COULEURS_PROD: Record<string, string> = {
  rouge: 'rouge', blanc: 'blanc', rose: 'rose', effervescent: 'bulles', bulles: 'bulles',
  doux: 'doux', liquoreux: 'doux', moelleux: 'doux', ambre: 'orange', orange: 'orange',
};
function couleursProducteur(v: unknown): string[] {
  return [...new Set(liste(v).map((c) => COULEURS_PROD[slug(c)] ?? slug(c)))];
}

/** connu_de_pat : true, « oui », ou une note laissée dans la colonne → connu ; « non » → non connu. */
function connu(v: unknown): boolean | null {
  if (v === true || v === 'true' || /^oui$/i.test(String(v)) || (typeof v === 'number' && v > 0)) return true;
  if (v === false || /^non$/i.test(String(v))) return false;
  return null;
}

/** Normalise une fiche producteur (JSON ou Excel) vers la table `producteur`. */
export function ficheProducteur(p: Ligne, regionKey: string, unique: (s: string) => string, statut = 'valide'): Ligne {
  const ancien = String(p.id ?? slug(String(p.nom)));
  const sp = statutProduction(p.statut_production);
  const gp = texte(p.gamme_prix);
  const aVerifier = [
    texte(p.a_verifier),
    gp && !GAMMES[gp] ? `gamme_prix d'origine : ${gp}` : null,
    texte(p.ranking_pat_suggere) ? `ranking suggéré : ${p.ranking_pat_suggere}` : null,
  ].filter(Boolean).join(' — ') || null;
  return {
    id: unique(`${regionKey}-prod-${slug(base(ancien, '-prod-'))}`),
    ancien_id: ancien,
    nom: texte(p.nom),
    pays: texte(p.pays),
    region: texte(p.region),
    sous_region: texte(p.sous_region),
    // Deux schémas coexistent : l'ancien (localisation, appellations_principales, couleurs_principales, cepages_rois)
    // et le nouveau (type « domaine », commune, appellations_lieux_dits, couleurs, cepages).
    localisation: texte(p.localisation) ?? texte(p.commune),
    appellations_texte: liste(p.appellations_principales ?? p.appellations_lieux_dits),
    statut_production: sp.statut,
    statut_precision: sp.precision,
    couleurs: couleursProducteur(p.couleurs_principales ?? p.couleurs),
    cepages_rois: liste(p.cepages_rois ?? p.cepages),
    niveau_reference: entier(p.niveau_reference),
    ranking_pat: entier(p.ranking_pat),
    connu_de_pat: connu(p.connu_de_pat),
    gamme_prix: gp ? GAMMES[gp] ?? null : null,
    notes_objectives: texte(p.notes_objectives),
    avis_critique: texte(p.mes_notes),
    avis_pat: texte(p.notes_pat),
    tags: liste(p.tags),
    source: texte(p.source),
    lpv_pages: entier(p.lpv_pages),
    a_verifier: aVerifier,
    statut,
  };
}

/** Relie un producteur aux terroirs de ses appellations quand le nom est reconnu. */
export function liensAppellations(prod: Ligne, terroirs: Ligne[]): Ligne[] {
  const out = new Set<string>();
  for (const a of prod.appellations_texte as string[]) {
    const k = cle(a).replace(/\b(gc|1er cru|premier cru)\b/g, '').trim();
    const t = terroirs.find((t) => cle(String(t.nom)).replace(/ aoc$/, '').trim() === k) ??
      terroirs.find((t) => k.startsWith(cle(String(t.nom)).replace(/ aoc$/, '').trim()) && String(t.nom).length > 4);
    if (t) out.add(String(t.id));
  }
  return [...out].map((terroir_id) => ({ producteur_id: prod.id, terroir_id }));
}

export async function importerProducteurs(dossier: string, terroirs: Ligne[]) {
  const unique = uniques();
  const producteurs: Ligne[] = [];
  const cuvees: Ligne[] = [];
  const liens: Ligne[] = [];
  for (const f of fs.readdirSync(dossier).sort()) {
    const p = path.join(dossier, f);
    let items: Ligne[] = [];
    let regionKey = '';
    if (f.endsWith('.json')) {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      items = d.items;
      regionKey = d.region_key;
    } else if (f.endsWith('.xlsx')) {
      regionKey = f.replace(/^producteurs_|\.xlsx$/g, '').replace(/_to_import/i, '');
      const wb = new (await import('exceljs')).default.Workbook();
      await wb.xlsx.readFile(p);
      items = enObjets(await lireFeuille(p, wb.worksheets[0].name))
        .filter((r) => texte(r['Nom du domaine']))
        .map((r) => ({
          id: r['ID'], nom: r['Nom du domaine'], pays: regionKey === 'piemonte' ? 'Italie' : null,
          region: regionKey === 'piemonte' ? 'Piemonte' : regionKey, sous_region: r['Sous-région'], localisation: r['Commune'],
          appellations_principales: liste(r['Appellations / lieux-dits']), cepages_rois: liste(r['Cépages']),
          couleurs_principales: liste(r['Couleurs']), statut_production: r['Statut production'], gamme_prix: r['Gamme prix'],
          niveau_reference: r['Niveau réf.'], ranking_pat: r['Ranking Pat'], connu_de_pat: r['Connu de Pat'],
          notes_objectives: r['Notes objectives'], mes_notes: r['Mes notes (Pat)'], notes_pat: r['Notes Pat'],
          cuvees_phares: liste(r['Cuvées phares'], /\s*;\s*/), tags: liste(r['Tags']), a_verifier: r['À vérifier'], source: r['Source'],
        }));
    } else continue;
    for (const it of items) {
      const prod = ficheProducteur(it, regionKey, unique);
      producteurs.push(prod);
      cuvees.push(...cuveesDepuis(prod, liste(it.cuvees_phares, /\s*;\s*/), terroirs));
      liens.push(...liensAppellations(prod, terroirs));
    }
  }
  return { producteurs, cuvees, liens, unique };
}

export { cleRegion };
