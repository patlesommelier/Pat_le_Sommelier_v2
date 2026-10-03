import fs from 'node:fs';
import path from 'node:path';
import { cle, cleRegion, enObjets, lireFeuille, slug, texte, uniques } from './util';
import { ficheProducteur, liensAppellations, type Ligne } from './pat';

const COULEURS: Record<string, string> = { BULLES: 'bulles', BLANCS: 'blanc', 'ROSÉS': 'rose', ROUGES: 'rouge', DOUX: 'doux', ORANGE: 'orange' };
const CATEGORIES: Record<string, string> = { 'Entrée': 'entree', 'Plat principal': 'plat', Dessert: 'dessert' };

/** « Douceur : 1/5 … Familles aromatiques : … » → objet utilisable par l'app (barres de la fiche vin). */
export function profilDegustation(t: unknown) {
  const s = texte(t);
  if (!s) return null;
  const note = (k: string) => {
    const m = s.match(new RegExp(`${k}\\s*:\\s*(\\d)\\s*/\\s*5`, 'i'));
    return m ? Number(m[1]) : null;
  };
  const champ = (k: string) => s.match(new RegExp(`${k}\\s*:\\s*([^\\n]+)`, 'i'))?.[1].trim() ?? null;
  const aromes = champ('Familles aromatiques');
  return {
    douceur: note('Douceur'), acidite: note('Acidit[ée]'), corps: note('Corps'),
    intensite: note('Intensit[ée] aromatique'), tanins: note('Tanins'), boise: note('Bois[ée]'),
    effervescence: champ('Effervescence'), stade: champ("Stade d'[ée]volution"),
    aromes: aromes ? aromes.split(/,\s*(?![^()]*\))/).map((a) => a.trim()) : [],
  };
}

function prixEtVariantes(prix: unknown, nom: string) {
  const nombres = (String(prix ?? '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
  const unites = nom.match(/–\s*(\d+\s*pièces?)\s*\/\s*(\d+\s*pièces?)/);
  const variantes = nombres.length > 1 && unites ? `${unites[1]} ${nombres[0]} € / ${unites[2]} ${nombres[1]} €` : null;
  return { prix: nombres[0] ?? null, variantes };
}

/** Repère les principes cités dans l'analyse (« • titre (à valider) ») à partir de leur titre. */
function principesCites(t: unknown, principes: Ligne[]): string[] {
  return String(t ?? '')
    .split('\n')
    .map((l) => cle(l.replace(/^[•\-\s]+/, '').replace(/\(à valider\)/, '')))
    .filter(Boolean)
    .map((l) => principes.find((p) => cle(String(p.titre)).startsWith(l.slice(0, 40)) || l.startsWith(cle(String(p.titre)).slice(0, 40)))?.id as string)
    .filter(Boolean);
}

function couleursDepuisProfil(profil: string): string[] {
  const k = cle(profil);
  const out = new Set<string>();
  if (/effervescent|champagne|bulle|cremant/.test(k)) out.add('bulles');
  if (/\bblancs?\b/.test(k)) out.add('blanc');
  if (/\brose\b/.test(k)) out.add('rose');
  if (/\brouges?\b/.test(k)) out.add('rouge');
  if (/\borange\b/.test(k)) out.add('orange');
  if (/doux|liquoreux|moelleux|vdn|mute|porto|botryt/.test(k)) out.add('doux');
  return [...out];
}

/** Producteur de la base dont le nom correspond (exactement, ou un nom contenu dans l'autre si c'est le seul). */
function producteurParNom(texteCarte: string, producteurs: Ligne[]): string | undefined {
  const k = cle(texteCarte.replace(/\(.*?\)/g, ''));
  if (k.length < 4) return undefined;
  const exact = producteurs.find((p) => cle(String(p.nom)) === k);
  if (exact) return String(exact.id);
  const proches = producteurs.filter((p) => {
    const n = cle(String(p.nom).replace(/\(.*?\)/g, ''));
    return n.length >= 4 && (n.startsWith(k + ' ') || k.startsWith(n + ' '));
  });
  return proches.length === 1 ? String(proches[0].id) : undefined;
}

/** Appellation de la base : « Alto Adige DOC », « Rioja DOCa », « Châteauneuf-du-Pape blanc »… */
function appellationParNom(texteCarte: string, appellations: Ligne[]): Ligne | undefined {
  const net = (t: string) => cle(t.replace(/\(.*?\)/g, '')).replace(/\b(aoc|aop|doc|docg|doca|do|igt|igp|vdp|rouge|blanc|rose)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const k = net(texteCarte);
  if (!k) return undefined;
  const parNom = appellations.filter((t) => net(String(t.nom)) === k);
  return parNom.find((t) => t.statut !== 'propose') ?? parNom[0];
}

/** « 4 », « 3 (fiche Meursault…) » → 4, 3 ; « n.d. », « Hors périmètre » → 0. */
function rankingCarte(v: unknown): number {
  const m = String(v ?? '').match(/^\s*([0-5])\b/);
  return m ? Number(m[1]) : 0;
}

/** Pays du vin : celui du producteur relié, sinon déduit de l'appellation écrite sur la carte. */
export function paysDuVin(vin: string, paysProducteur?: string): string {
  if (paysProducteur) return paysProducteur;
  if (/\b(DOCG?|IGT|DOC\/DOCG)\b|Terre Siciliane|Toscana|Alto Adige|Valdobbiadene|Sardegna|Etna|Bolgheri/i.test(vin)) return 'Italie';
  if (/\b(DOCa|DO)\b|Rioja|Ribera del Duero|Montsant|Bierzo|Priorat/i.test(vin)) return 'Espagne';
  if (/Alentej|Douro|Dão|Vinho Regional/i.test(vin)) return 'Portugal';
  if (/Uruguay/i.test(vin)) return 'Uruguay';
  return 'France';
}

export async function importerRestaurant(dossier: string, principes: Ligne[], producteurs: Ligne[], terroirs: Ligne[], uniqueProd: (s: string) => string) {
  const meta = JSON.parse(fs.readFileSync(path.join(dossier, 'restaurant.json'), 'utf8'));
  const rid: string = meta.id;
  const restaurant = {
    id: rid, nom: meta.nom, couleur: meta.couleur, couleur_claire: meta.couleur_claire,
    logo_url: meta.logo_url, accroche: meta.accroche, police_titres: meta.police_titres,
  };

  // ── Menu et profils d'accord ──
  const plats: Ligne[] = [];
  const profils: Ligne[] = [];
  const uniquePlat = uniques();
  const lignesMenu = enObjets(await lireFeuille(path.join(dossier, meta.fichiers.menu), 'Analyse'));
  lignesMenu.forEach((m, i) => {
    const nomBrut = texte(m['Nom du plat']);
    if (!nomBrut) return;
    const nom = nomBrut.replace(/\s*–\s*\d+\s*pièces?\s*\/\s*\d+\s*pièces?$/, '').trim();
    const court = (meta.noms_courts as [string, string][]).find(([debut]) => nomBrut.startsWith(debut))?.[1] ?? null;
    const { prix, variantes } = prixEtVariantes(m['Prix (€)'], nomBrut);
    const categorie = /fromages/i.test(nom) ? 'fromage' : CATEGORIES[String(m['Type de plat'])] ?? 'plat';
    const id = uniquePlat(`${rid}-${slug(court ?? nom)}`);
    plats.push({ id, restaurant_id: rid, nom, nom_court: court, categorie, prix, prix_variantes: variantes, specialite_maison: false, actif: true, ordre: i, _nom_brut: nomBrut });

    const analyse = String(m["Résultat de l'analyse"] ?? '');
    const champ = (k: string) => analyse.match(new RegExp(`^${k}\\s*:\\s*(.+)$`, 'mi'))?.[1].trim() ?? null;
    const profil = champ('Profil') ?? '';
    profils.push({
      plat_id: id,
      ancrages: (champ('Ancrages') ?? '').replace(/\.$/, '').split(/,\s*(?![^()]*\))/).map((s) => s.trim()).filter(Boolean),
      profil: profil || null,
      couleurs_ok: couleursDepuisProfil(profil.split(/[.;]/)[0]),
      cepages_conseilles: (champ('Cépages') ?? '').replace(/\.$/, '').split(/,\s*(?![^()]*\))/).map((s) => s.trim()).filter(Boolean),
      a_eviter: champ('À éviter') ?? champ('A éviter'),
      temperature_service: champ('Service'),
      principes: principesCites(m['Principes de Pat utilisés'], principes),
      plafond: null,
      version_principes: 'V4',
      texte_complet: analyse || null,
    });
  });

  // ── Carte des vins (+ producteurs à ajouter, avec le statut « proposé ») ──
  const vins: Ligne[] = [];
  const nouveauxProducteurs: Ligne[] = [];
  const liens: Ligne[] = [];
  const prodParCode = new Map<string, string>();
  const coupsDeCoeur = new Set<string>();
  const prixVerre = new Map<string, number>();

  for (const f of meta.fichiers.carte as string[]) {
    const fichier = path.join(dossier, f);
    for (const p of enObjets(await lireFeuille(fichier, 'Producteurs à ajouter'))) {
      // Les fiches d'attente (« NE PAS VALIDER en l'état ») ne deviennent pas des producteurs.
      if (!texte(p.id) || String(p.id).startsWith('attente-')) continue;
      const brut = { ...p, appellations_principales: String(p.appellations_principales ?? '').split(/\s*;\s*/), couleurs_principales: String(p.couleurs_principales ?? '').split(/\s*;\s*/), tags: String(p.tags ?? '').split(/\s*;\s*/), cepages_rois: String(p.cepages_rois ?? '').split(/\s*;\s*/) };
      const deja = producteurs.find((x) => cle(String(x.nom)) === cle(String(p.nom)));
      const prod = deja ?? ficheProducteur(brut, cleRegion(String(p.region)), uniqueProd, 'propose');
      if (!deja) {
        nouveauxProducteurs.push(prod);
        liens.push(...liensAppellations(prod, terroirs));
      }
      for (const code of String(p.vins_sur_la_carte_L ?? '').match(/L-[A-Z]\d{2}/g) ?? []) prodParCode.set(code, String(prod.id));
    }
    for (const n of enObjets(await lireFeuille(fichier, 'Notes'))) {
      const point = String(n['Point'] ?? ''), detail = String(n['Détail'] ?? '');
      if (/coups? de c/i.test(point)) (detail.match(/L-[A-Z]\d{2}/g) ?? []).forEach((c) => coupsDeCoeur.add(c));
      if (/prix au verre/i.test(point)) {
        for (const m of detail.matchAll(/(\d+(?:[.,]\d+)?)\s*€\s*\((?:=\s*)?(L-[A-Z]\d{2})/g)) prixVerre.set(m[2], Number(m[1].replace(',', '.')));
        for (const m of detail.matchAll(/(\d+(?:[.,]\d+)?)\s*€[^.]*?\b(L-[A-Z]\d{2})\/([A-Z]\d{2})/g)) prixVerre.set(`L-${m[3]}`, Number(m[1].replace(',', '.')));
      }
    }
  }
  const tousProducteurs = [...producteurs, ...nouveauxProducteurs];
  const appellations = terroirs.filter((t) => t.niveau === 'appellation');
  let couleur = 'blanc';
  let ordre = 0;
  for (const f of meta.fichiers.carte as string[]) {
    for (const v of enObjets(await lireFeuille(path.join(dossier, f), 'Carte des vins'))) {
      const ref = texte(v['Nom référence']);
      if (!ref) continue;
      // Ligne de section (cellule fusionnée : « BLANCS » répété sur toute la ligne)
      if (!ref.includes(' · ')) { couleur = COULEURS[ref.toUpperCase()] ?? couleur; continue; }
      const code = ref.split(' · ')[0];
      let libelle = ref.split(' · ').slice(1).join(' · ').replace(/ · 37,5 cl$/, '').replace(/\s*\(au verre\)/, '');
      libelle = libelle.replace(/\s+(NM|\d{4}(-\d{4})?)$/, '');
      const prodTexte = texte(v['Producteur']);
      const prodId = prodParCode.get(code) ?? (prodTexte && !/^non /i.test(prodTexte) ? producteurParNom(prodTexte, tousProducteurs) : undefined);
      const appTexte = String(v['Vin'] ?? '').split(' – ')[0];
      const app = appellationParNom(appTexte, appellations);
      const etiquette = path.join('public', 'restaurants', rid, 'etiquettes', `${code}.jpg`);
      vins.push({
        id: code, restaurant_id: rid, couleur, section: meta.sections?.[code] ?? null, libelle,
        producteur_id: prodId ?? null, producteur_texte: prodTexte, cuvee_id: null, appellation_id: app?.id ?? null,
        vin_texte: texte(v['Vin']), millesime: texte(v['Millésime']),
        format: /37,5 cl/.test(ref) ? '37,5 cl' : /au verre/.test(ref) ? 'au verre' : '75 cl',
        prix: typeof v['Prix (€)'] === 'number' ? v['Prix (€)'] : null, prix_verre: prixVerre.get(code) ?? null,
        cepages: texte(v['Cépages']), profil_degustation: profilDegustation(v['Profil de dégustation (objectif)']),
        descriptif: texte(v['Descriptif du vin']), presentation: texte(v['Présentation commerciale']), resume_court: texte(v['Résumé court']),
        etiquette_url: fs.existsSync(etiquette) ? `/restaurants/${rid}/etiquettes/${code}.jpg` : null,
        // Rankings tels que la carte les donne (règles de sélection V7) ; « n.d. », « Hors périmètre » → 0.
        ranking_producteur: rankingCarte(v['Ranking Pat producteur']),
        // Pas de chiffre sur la carte (vin noté « hors périmètre » avant l'ajout des régions étrangères) : ranking de l'appellation.
        ranking_terroir: rankingCarte(v['Ranking Pat terroir']) || (app && /hors périmètre|n\.d\./i.test(String(v['Ranking Pat terroir'] ?? '')) ? Number(app.ranking_pat ?? 0) : 0),
        pays: paysDuVin(String(v['Vin'] ?? ''), tousProducteurs.find((p) => p.id === prodId)?.pays as string | undefined),
        coup_de_coeur: coupsDeCoeur.has(code), disponible: true,
        a_verifier: /non précisée|à confirmer|non indiqué|non identifié/i.test(String(v['Vin']) + String(prodTexte)) ? `${prodTexte ?? ''} — ${v['Vin'] ?? ''}` : null,
        ordre: ordre++,
      });
    }
  }

  // Une contenance sans étiquette reprend celle du même vin dans l'autre contenance (R de Ruinart 37,5 cl → 75 cl).
  for (const v of vins.filter((x) => !x.etiquette_url)) {
    v.etiquette_url = vins.find((x) => x.etiquette_url && x.libelle === v.libelle)?.etiquette_url ?? null;
  }
  for (const v of vins) v.etiquette_source = v.etiquette_url ? 'fichier' : null;

  // ── Accords mets/vins de Pat (onglet « Détail (filtrable) » : une ligne par plat × vin, note 1 à 5) ──
  // Les accords de ce fichier sont l'analyse de Pat : ils arrivent « validés ». Le rang départage les ex aequo
  // dans l'ordre de la carte, comme l'onglet « Meilleurs accords » du fichier.
  const accords: Ligne[] = [];
  const fa = path.join(dossier, 'accords.xlsx');
  if (fs.existsSync(fa)) {
    const numeroVersId = new Map(principes.map((p) => [Number(p.numero), String(p.id)]));
    const ordreVin = new Map(vins.map((v) => [String(v.id), Number(v.ordre)]));
    const parPlat = new Map<string, Ligne[]>();
    for (const l of enObjets(await lireFeuille(fa, 'Détail (filtrable)'))) {
      const nomPlat = texte(l['Plat']);
      const code = String(l['Vin'] ?? '').match(/^L-[A-Z]\d{2}/)?.[0];
      const note = Number(l['Note']);
      if (!nomPlat || !code || !(note >= 1 && note <= 5)) continue;
      const plat = plats.find((p) => p._nom_brut === nomPlat) ?? plats.find((p) => nomPlat.startsWith(String(p.nom)));
      if (!plat || !ordreVin.has(code)) continue;
      const commentaire = texte(l['Commentaire']) ?? '';
      const principesCites = (String(l['Principes de Pat'] ?? '').match(/\d+/g) ?? []).map(Number).map((n) => numeroVersId.get(n)).filter(Boolean);
      const profil = profils.find((pr) => pr.plat_id === plat.id);
      const a: Ligne = {
        restaurant_id: rid, plat_id: plat.id, vin_id: code, note,
        // Le texte client ne montre pas les références « (P10, P35) » : elles restent dans `principes`.
        explication: commentaire.replace(/\s*\((?:P\d+(?:,\s*)?)+\)/g, '').replace(/\s+([.,])/g, '$1').replace(/\s{2,}/g, ' ').trim() || null,
        principes: principesCites,
        service: String(profil?.temperature_service ?? '').match(/\d+(?:\s*-\s*\d+)?\s*°C/)?.[0] ?? null,
        origine: 'pat', statut: 'valide',
      };
      parPlat.set(String(plat.id), [...(parPlat.get(String(plat.id)) ?? []), a]);
    }
    for (const liste of parPlat.values()) {
      liste.sort((x, y) => Number(y.note) - Number(x.note) || ordreVin.get(String(x.vin_id))! - ordreVin.get(String(y.vin_id))!);
      liste.forEach((a, i) => accords.push({ ...a, rang: i + 1 }));
    }
  }
  plats.forEach((p) => delete p._nom_brut);

  // ── Règles du sommelier ──
  // regles_selection.xlsx : règles de classement et de sélection (V7). Elles sont appliquées par src/lib/selection.ts ;
  // la base en garde le texte pour référence. regles.json (facultatif) : consignes ponctuelles (exclure un vin…).
  const reglesSelection: Ligne[] = [];
  const fs7 = path.join(dossier, meta.fichiers.regles_selection ?? 'regles_selection.xlsx');
  if (fs.existsSync(fs7)) {
    const version = enObjets(await lireFeuille(fs7, 'Lisez-moi')).find((l) => Object.values(l).includes('Version'));
    const versionTexte = version ? String(Object.values(version)[1] ?? '') : null;
    for (const onglet of ['Plat seul', 'Plat + sauce', 'Plusieurs plats', 'Hors menu', 'Tour 2 et verre']) {
      enObjets(await lireFeuille(fs7, onglet)).forEach((r, i) => {
        if (!texte(r['Énoncé'])) return;
        const ordre = String(r['Ordre']);
        reglesSelection.push({
          id: `${rid}-${slug(onglet)}-${slug(ordre)}`, restaurant_id: rid, onglet, ordre, rang: i + 1,
          nom: texte(r['Règle']), type: texte(r['Type']), enonce: texte(r['Énoncé']), statut: texte(r['Statut']),
          version: versionTexte?.split(' (')[0] ?? null,
        });
      });
    }
  }
  const fr = path.join(dossier, 'regles.json');
  const regles: Ligne[] = fs.existsSync(fr)
    ? JSON.parse(fs.readFileSync(fr, 'utf8')).regles.map((r: Ligne) => ({ ...r, restaurant_id: rid, priorite: r.priorite ?? 1 }))
    : [];

  return { restaurant, plats, profils, vins, nouveauxProducteurs, liens, accords, regles, reglesSelection };
}
