/**
 * Accords de référence de l'App consommateur (data/app/accords-reference.json, tiré de accords_vPat.xlsx) : chargés dans
 * la table accord_reference au déploiement. Seuls les accords absents sont ajoutés : une fiche modifiée dans la base le reste.
 *
 * Sans 'server-only' : appelé par scripts/migrer.ts.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Requete } from '../generation/accords';

type Axe = { categorie_vin: string; vins_recommandes: string; mecanique_accord: string; justification_courte: string } | null;
export interface AccordReferenceSource {
  id: string; nom: string; famille: string | null; sous_famille: string | null; variantes: string | null; axes_accord: string | null;
  intensite: number | null; categorie_vin_principale: string | null; vins_recommandes: string | null; producteurs_phares: string | null;
  alternative_accessible: string | null; justification_charnelle: string | null; notes_pratiques: string | null; mes_notes: string | null;
  ranking_pat: number | null; tags: string[] | null; source: string | null; a_verifier: string | null; commentaire_delmas: string | null;
  axe_diversite_2: Axe; axe_diversite_3: Axe;
}

const COLONNES = ['id', 'nom', 'famille', 'sous_famille', 'variantes', 'axes_accord', 'intensite', 'categorie_vin_principale', 'vins_recommandes',
  'producteurs_phares', 'alternative_accessible', 'justification_charnelle', 'notes_pratiques', 'mes_notes', 'ranking_pat', 'tags', 'source',
  'a_verifier', 'commentaire_delmas', 'axe_diversite_2', 'axe_diversite_3'] as const;

export async function importerAccordsReference(requete: Requete, fichier = path.join(process.cwd(), 'data/app/accords-reference.json')) {
  const { items } = JSON.parse(await readFile(fichier, 'utf8')) as { items: AccordReferenceSource[] };
  let ajoutes = 0;
  for (const a of items) {
    const valeurs = COLONNES.map((c) => (c === 'axe_diversite_2' || c === 'axe_diversite_3' ? (a[c] ? JSON.stringify(a[c]) : null)
      : c === 'tags' ? a.tags ?? [] : a[c] ?? null));
    const r = await requete(
      `insert into accord_reference (${COLONNES.join(', ')}) values (${COLONNES.map((_, i) => `$${i + 1}`).join(', ')})
       on conflict (id) do nothing returning id`, valeurs);
    ajoutes += r.length;
  }
  return ajoutes;
}
