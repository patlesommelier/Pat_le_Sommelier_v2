// Les deux vins du Comptoir dont l'étiquette de la base n'arrivait pas : rejoués sur une petite base simulée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuveeCorrespondante, partagerEtiquettes } from '../src/lib/etiquettes/partage';
import { rattacherProducteurs } from '../src/lib/producteurs/rattachement';
import type { Requete } from '../src/lib/generation/accords';

type Producteur = { id: string; nom: string; statut: string; appellations: string[] | null; region: string | null; ranking_pat: number | null };
type Cuvee = { id: string; producteur_id: string; nom: string; couleur: string | null; appellation: string | null; cepages: string | null; statut: string; etiquette_url: string | null };
type VinCarte = { id: string; libelle: string; vin_texte: string | null; couleur: string; cepages: string | null; producteur_id: string | null;
  producteur_texte: string | null; appellation_texte: string | null; cuvee_id: string | null; etiquette_url: string | null; etiquette_source: string | null };

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Base simulée : seulement les requêtes de rattacherProducteurs et partagerEtiquettes. */
function base(producteurs: Producteur[], cuvees: Cuvee[], vins: VinCarte[]): Requete {
  return (async (sql: string, p: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ');
    if (s.startsWith('select v.id, v.libelle, v.producteur_texte, coalesce(t.nom')) // rattacher : vins sans producteur
      return vins.filter((v) => !v.producteur_id).map((v) => ({ ...v, appellation: v.appellation_texte }));
    if (s.startsWith('select nom, appellations_texte')) return producteurs.filter((x) => x.statut !== 'retire').map((x) => ({ ...x }));
    if (s.startsWith('select nom from terroir')) return [{ nom: 'Costières de Nîmes AOC' }, { nom: 'Rheinhessen' }];
    if (s.startsWith('select id, nom, statut::text from producteur')) {
      const [motifs, exclure, valide] = p as [string[], string, boolean];
      return producteurs.filter((x) => x.statut !== 'retire' && x.id !== exclure && (!valide || x.statut === 'valide')
        && motifs.every((m) => sansAccents(x.nom).includes(m.replace(/%/g, ''))))
        .sort((a, b) => Number(b.statut === 'valide') - Number(a.statut === 'valide') || a.nom.length - b.nom.length);
    }
    if (s.startsWith('update vin_carte v set producteur_id = p.id')) {
      const [ids, pid] = p as [string[], string];
      for (const v of vins) if (ids.includes(v.id)) v.producteur_id = pid;
      return [];
    }
    if (s.startsWith('select p.id, p.nom from producteur p where p.statut = \'propose\''))
      return producteurs.filter((x) => x.statut === 'propose' && vins.some((v) => v.producteur_id === x.id));
    if (s.startsWith('select v.id, v.libelle, v.vin_texte')) { // partage : vins
      return vins.filter((v) => !p[0] || (p[0] as string[]).includes(v.id)).map((v) => {
        const c = cuvees.find((x) => x.id === v.cuvee_id);
        return { ...v, producteur_nom: producteurs.find((x) => x.id === v.producteur_id)?.nom ?? null, appellation_id: null, appellation_nom: null,
          cuvee_producteur: c?.producteur_id ?? null, cuvee_retiree: c?.statut === 'retire' };
      });
    }
    if (s.startsWith('select c.id, c.nom, c.couleur::text')) return cuvees.filter((c) => c.producteur_id === p[0] && c.statut !== 'retire').map((c) => ({ ...c }));
    if (s.startsWith('update vin_carte set cuvee_id')) { vins.find((v) => v.id === p[0])!.cuvee_id = p[1] as string | null; return []; }
    if (s.startsWith('update vin_carte v set etiquette_url = c.etiquette_url')) {
      const touchees = p[0] as string[];
      return vins.filter((v) => {
        const c = cuvees.find((x) => x.id === v.cuvee_id && touchees.includes(x.id) && x.etiquette_url);
        if (!c || !(!v.etiquette_url || v.etiquette_source === 'cuvee') || v.etiquette_url === c.etiquette_url) return false;
        v.etiquette_url = c.etiquette_url; v.etiquette_source = 'cuvee';
        return true;
      }).map((v) => ({ id: v.id }));
    }
    if (s.startsWith('update vin_carte v set etiquette_url = null')) return [];
    if (s.startsWith('select count(*)::int as n from cuvee')) return [{ n: cuvees.filter((c) => c.producteur_id === p[0]).length }];
    if (s.startsWith('update producteur set statut')) return [];
    if (s.startsWith('select id from vin_carte where producteur_id')) return vins.filter((v) => v.producteur_id === p[0]).map((v) => ({ id: v.id }));
    throw new Error(`requête non simulée : ${s.slice(0, 80)}`);
  }) as Requete;
}

const vinCarte = (x: Partial<VinCarte> & Pick<VinCarte, 'id' | 'libelle' | 'couleur'>): VinCarte => ({ vin_texte: null, cepages: null, producteur_id: null,
  producteur_texte: null, appellation_texte: null, cuvee_id: null, etiquette_url: null, etiquette_source: null, ...x });
const prod = (id: string, nom: string, statut = 'valide', region: string | null = null): Producteur => ({ id, nom, statut, appellations: null, region, ranking_pat: 4 });
const cuv = (x: Partial<Cuvee> & Pick<Cuvee, 'id' | 'producteur_id' | 'nom'>): Cuvee => ({ couleur: 'blanc', appellation: null, cepages: null, statut: 'valide', etiquette_url: null, ...x });

test('le nom du propriétaire lu sur la carte ne gêne pas (« Château Mourgues du Grès - François Collard »)', () => {
  const galets = [{ id: 'gd', nom: 'Galets Dorés', couleur: 'blanc', appellation: 'Costières de Nîmes' }];
  assert.equal(cuveeCorrespondante({ libelle: 'Costières de Nîmes Château Mourgues du Grès - François Collard', vin_texte: 'Costières de Nîmes', couleur: 'blanc',
    producteur_nom: 'Château Mourgues du Grès', producteur_texte: 'Château Mourgues du Grès - François Collard' }, galets)?.id, 'gd');
});

test('le seul vin de cette couleur du producteur, sans appellation renseignée dans la base', () => {
  const v = { libelle: 'Costières de Nîmes', vin_texte: 'Costières de Nîmes', couleur: 'blanc', producteur_nom: 'Château Mourgues du Grès' };
  assert.equal(cuveeCorrespondante(v, [{ id: 'gd', nom: 'Galets Dorés', couleur: 'blanc' }, { id: 'r', nom: 'Galets Rouges', couleur: 'rouge' }])?.id, 'gd');
  // Deux blancs : on ne choisit pas.
  assert.equal(cuveeCorrespondante(v, [{ id: 'gd', nom: 'Galets Dorés', couleur: 'blanc' }, { id: 'ta', nom: 'Terre d’Argence', couleur: 'blanc' }]), null);
});

test("l'appellation écrite dans le nom de la cuvée peut manquer sur la carte ; à égalité, la cuvée qui a une étiquette", () => {
  const v = { libelle: 'Allemagne - Riesling "Eisquell" - Weingut Battenfeld Spanier', vin_texte: null, couleur: 'blanc', producteur_nom: 'Battenfeld-Spanier', cepages: 'Riesling' };
  assert.equal(cuveeCorrespondante(v, [{ id: 'e', nom: 'Rheinhessen Riesling trocken Eisquell', couleur: 'blanc', appellation: 'Rheinhessen' }])?.id, 'e');
  assert.equal(cuveeCorrespondante(v, [{ id: 'a', nom: 'Eisquell', couleur: 'blanc' }, { id: 'b', nom: 'Eisquell', couleur: 'blanc', etiquette_url: 'x.jpg' }])?.id, 'b');
});

test('B21 : producteur « Non précisé » sur la carte, retrouvé dans le nom du vin, puis étiquette de la cuvée', async () => {
  const producteurs = [prod('bs', 'Battenfeld-Spanier', 'valide', 'Rheinhessen')];
  const cuvees = [cuv({ id: 'bs-eisquell', producteur_id: 'bs', nom: 'Riesling Eisquell', etiquette_url: 'https://x/eisquell.jpg' })];
  const vins = [vinCarte({ id: 'le-comptoir-B21', libelle: 'Allemagne - Riesling "Eisquell" - Weingut Battenfeld Spanier', couleur: 'blanc', cepages: 'Riesling', producteur_texte: 'Non précisé' })];
  const q = base(producteurs, cuvees, vins);
  await rattacherProducteurs(q);
  assert.equal(vins[0].producteur_id, 'bs');
  await partagerEtiquettes(q);
  assert.equal(vins[0].etiquette_url, 'https://x/eisquell.jpg');
});

test('B21 : vin relié à un doublon validé du producteur (« Weingut Battenfeld Spanier ») : la cuvée est chez l’autre', async () => {
  const producteurs = [prod('bs', 'Battenfeld-Spanier'), prod('ins-bs', 'Weingut Battenfeld Spanier')];
  const cuvees = [cuv({ id: 'bs-eisquell', producteur_id: 'bs', nom: 'Eisquell Riesling', etiquette_url: 'https://x/eisquell.jpg' })];
  const vins = [vinCarte({ id: 'le-comptoir-B21', libelle: 'Allemagne - Riesling "Eisquell" - Weingut Battenfeld Spanier', couleur: 'blanc', producteur_id: 'ins-bs' })];
  const q = base(producteurs, cuvees, vins);
  await partagerEtiquettes(q);
  assert.equal(vins[0].cuvee_id, 'bs-eisquell');
  assert.equal(vins[0].etiquette_url, 'https://x/eisquell.jpg');
  // Deuxième passage (déploiement suivant) : rien ne change.
  await partagerEtiquettes(q);
  assert.equal(vins[0].etiquette_url, 'https://x/eisquell.jpg');
});

test('B15 : vin relié à « Château Mourgues du Grès - François Collard » validé ; la cuvée est chez « Château Mourgues du Grès »', async () => {
  const producteurs = [prod('mdg', 'Château Mourgues du Grès'), prod('ins-mdg', 'Château Mourgues du Grès - François Collard')];
  const cuvees = [
    cuv({ id: 'mdg-galets-dores', producteur_id: 'mdg', nom: 'Galets Dorés', appellation: 'Costières de Nîmes', etiquette_url: 'https://x/galets.jpg' }),
    cuv({ id: 'mdg-galets-rouges', producteur_id: 'mdg', nom: 'Galets Rouges', couleur: 'rouge', appellation: 'Costières de Nîmes' }),
  ];
  const vins = [vinCarte({ id: 'le-comptoir-B15', libelle: 'Costières de Nîmes', vin_texte: 'Costières de Nîmes', couleur: 'blanc', producteur_id: 'ins-mdg',
    producteur_texte: 'Château Mourgues du Grès - François Collard' })];
  await partagerEtiquettes(base(producteurs, cuvees, vins));
  assert.equal(vins[0].etiquette_url, 'https://x/galets.jpg');
});

test('B15 : vin sans producteur, nom lu avec le propriétaire, cuvée de la base sans appellation', async () => {
  const producteurs = [prod('mdg', 'Château Mourgues du Grès')];
  const cuvees = [cuv({ id: 'mdg-galets-dores', producteur_id: 'mdg', nom: 'Galets Dorés', etiquette_url: 'https://x/galets.jpg' })];
  const vins = [vinCarte({ id: 'le-comptoir-B15', libelle: 'Costières de Nîmes', vin_texte: 'Costières de Nîmes', couleur: 'blanc',
    producteur_texte: 'Château Mourgues du Grès - François Collard' })];
  const q = base(producteurs, cuvees, vins);
  await rattacherProducteurs(q);
  await partagerEtiquettes(q);
  assert.equal(vins[0].etiquette_url, 'https://x/galets.jpg');
});

test('B15 tel qu’en ligne : « Costières de Nîmes "Galets Dorés" - … », cuvée « Galets Dorés » sans appellation dans la base', async () => {
  const libelle = 'Costières de Nîmes "Galets Dorés" - Château Mourgues du Grès - François Collard';
  for (const [nomCuvee, vin_texte, chezHomonyme] of [['Galets Dorés', null, false], ['Galets Dorés Blanc', 'Costières de Nîmes', false], ['Galets Dorés', null, true]] as const) {
    const producteurs = [prod('mdg-fc', 'Château Mourgues du Grès - François Collard'), prod('mdg', 'Château Mourgues du Grès')];
    const cuvees = [
      cuv({ id: 'gd', producteur_id: chezHomonyme ? 'mdg' : 'mdg-fc', nom: nomCuvee, etiquette_url: 'https://x/galets.jpg' }),
      cuv({ id: 'ta', producteur_id: chezHomonyme ? 'mdg' : 'mdg-fc', nom: 'Terre d’Argence', etiquette_url: 'https://x/ta.jpg' }),
    ];
    const vins = [vinCarte({ id: 'le-comptoir-B15', libelle, vin_texte, couleur: 'blanc', producteur_id: 'mdg-fc', producteur_texte: 'Château Mourgues du Grès' })];
    await partagerEtiquettes(base(producteurs, cuvees, vins));
    assert.equal(vins[0].etiquette_url, 'https://x/galets.jpg', `${nomCuvee} / ${vin_texte} / ${chezHomonyme}`);
  }
  // Une cuvée d'une autre appellation ne convient pas.
  assert.equal(cuveeCorrespondante({ libelle, vin_texte: null, couleur: 'blanc', producteur_nom: 'Château Mourgues du Grès' },
    [{ id: 'gd', nom: 'Galets Dorés', couleur: 'blanc', appellation: 'IGP Pays d’Oc' }], ['Costières de Nîmes AOC']), null);
});
