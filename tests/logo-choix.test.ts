// Logo affiché dans l'app : le choix du restaurant, sinon le plus lisible sur sa couleur, sinon le seul déposé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logoAffiche } from '../src/lib/couleurs';

test('le logo choisi est affiché ; un seul logo déposé est toujours affiché', () => {
  const fonce = '#5A1020', clair = '#F6E7C8';
  assert.equal(logoAffiche({ couleur: fonce, logo_url: null, logo_fonce_url: '/f.png' })?.url, '/f.png'); // seul le foncé : il s'affiche
  assert.equal(logoAffiche({ couleur: fonce, logo_url: '/c.png', logo_fonce_url: '/f.png' })?.url, '/c.png');
  assert.equal(logoAffiche({ couleur: clair, logo_url: '/c.png', logo_fonce_url: '/f.png' })?.url, '/f.png');
  assert.equal(logoAffiche({ couleur: fonce, logo_url: '/c.png', logo_fonce_url: '/f.png', logo_choix: 'fonce', logo_fonce_ratio: 1.2 })?.ratio, 1.2);
  assert.equal(logoAffiche({ couleur: clair, logo_url: '/c.png', logo_fonce_url: null, logo_choix: 'fonce' })?.url, '/c.png');
  assert.equal(logoAffiche({ couleur: clair, logo_url: null, logo_fonce_url: null }), null);
});
