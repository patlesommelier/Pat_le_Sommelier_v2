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
    plats.push({ id, restaurant_id: rid, nom, nom_court: court, categorie, prix, prix_variantes: variantes, specialite_maison: false, actif: true, ordre: i });

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
  const appellations = terroirs.filter((t) => String(t.type).startsWith('appellation'));
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
      const prodId = prodParCode.get(code) ??
        (prodTexte && !/^non /i.test(prodTexte) ? tousProducteurs.find((p) => cle(String(p.nom)) === cle(prodTexte.replace(/\(.*\)/, '')))?.id : undefined);
      const appTexte = String(v['Vin'] ?? '').split(' – ')[0];
      const app = appellations.find((t) => cle(String(t.nom)).replace(/ aoc$/, '').trim() === cle(appTexte).replace(/\b(rouge|blanc)\b/g, '').trim());
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
        coup_de_coeur: coupsDeCoeur.has(code), disponible: true,
        a_verifier: /non précisée|à confirmer|non indiqué|non identifié/i.test(String(v['Vin']) + String(prodTexte)) ? `${prodTexte ?? ''} — ${v['Vin'] ?? ''}` : null,
        ordre: ordre++,
      });
    }
  }

  // ── Accords d'exemple et règles du sommelier ──
  const accords: Ligne[] = [];
  const fa = path.join(dossier, 'accords_exemple.json');
  if (fs.existsSync(fa)) {
    for (const a of JSON.parse(fs.readFileSync(fa, 'utf8')).accords) {
      const plat = plats.find((p) => p.nom_court === a.plat);
      if (!plat) continue;
      accords.push({ restaurant_id: rid, plat_id: plat.id, vin_id: a.vin, note: a.note, rang: a.rang, explication: a.explication, principes: a.principes, service: a.service, origine: 'pat', statut: 'propose' });
    }
  }
  const fr = path.join(dossier, 'regles.json');
  const regles: Ligne[] = fs.existsSync(fr)
    ? JSON.parse(fs.readFileSync(fr, 'utf8')).regles.map((r: Ligne) => ({ ...r, restaurant_id: rid, priorite: r.priorite ?? 1 }))
    : [];

  return { restaurant, plats, profils, vins, nouveauxProducteurs, liens, accords, regles };
}
