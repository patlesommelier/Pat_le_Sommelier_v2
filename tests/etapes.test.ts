import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapeCourante, resumePublic, type Analyses } from '../src/lib/inscription/etapes';
import type { Plat, VinRapproche } from '../src/lib/inscription/donnees';

const vin: VinRapproche = { libelleCarte: 'Sancerre', producteur: 'Henri Bourgeois', appellation: null, millesime: '2025', contenance: null,
  prix: 58, prixVerre: null, auVerre: false, couleur: 'blanc', region: null, vinId: 'v1', producteurStatut: 'reference' };
const plat: Plat = { nom: 'Filet pur, sauce morilles', categorie: 'plat', description: null };
const base = (p: { vins?: VinRapproche[]; plats?: Plat[]; lecture?: Analyses } = {}) => ({ vins: [], plats: [], lecture: {}, ...p });

test('ordre des étapes : carte des vins, puis menu, puis restaurant', () => {
  assert.equal(etapeCourante(null), 'carte');
  assert.equal(etapeCourante(base()), 'carte');
  assert.equal(etapeCourante(base({ vins: [vin] })), 'menu');
  assert.equal(etapeCourante(base({ vins: [vin], plats: [plat] })), 'restaurant');
});

test('le navigateur ne reçoit que des compteurs, jamais les listes', () => {
  const r = resumePublic(base({ vins: Array(71).fill(vin), plats: Array(39).fill(plat),
    lecture: { carte: { statut: 'ok', nombre: 71 }, menu: { statut: 'ok', nombre: 39 } } }));
  assert.deepEqual(r, { etape: 'restaurant', carte: { statut: 'ok', nombre: 71, message: undefined }, menu: { statut: 'ok', nombre: 39, message: undefined } });
  const json = JSON.stringify(r);
  for (const mot of ['Sancerre', 'Bourgeois', 'vinId', 'ranking', 'score', 'limite']) assert.ok(!json.includes(mot), mot);
});

test('lecture en attente ou en cours : « en_cours » ; bloquée depuis plus de 15 minutes : interrompue', () => {
  const vieux = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  assert.equal(resumePublic(base({ lecture: { carte: { statut: 'en_cours', lanceeLe: vieux } } })).carte?.statut, 'erreur');
  assert.equal(resumePublic(base({ lecture: { carte: { statut: 'en_attente', lanceeLe: new Date().toISOString() } } })).carte?.statut, 'en_cours');
  assert.equal(resumePublic(base({ lecture: { menu: { statut: 'erreur', message: 'illisible' } } })).menu?.statut, 'erreur');
});
